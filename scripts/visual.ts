import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { examples } from "../examples/index.ts";
import { bridgeRoot } from "./bridge-paths.ts";
import { Bridge } from "./bridge-client.ts";
import { decodeTga } from "./tga.ts";
import { addBackdrop, layoutSnapshot, treeDiff } from "./visual-utils.ts";

const update = Bun.argv.includes("--update");
const filterIndex = Bun.argv.indexOf("--filter");
const filter = filterIndex >= 0 ? Bun.argv[filterIndex + 1] : undefined;
const names = Object.keys(examples).filter((name) => !filter || name.includes(filter));
const baseDir = join(process.cwd(), "test", "visual");
const outDir = join(baseDir, ".out");
await mkdir(outDir, { recursive: true });
const bridge = new Bridge(bridgeRoot().storage);
const reports: { name: string; ok: boolean; details: string[] }[] = [];
let interrupted = false;
process.on("SIGINT", () => {
  interrupted = true;
});

try {
  const ping = await bridge.ping();
  if (ping.context === "none")
    throw new Error("No game context. Open a map or the main menu before running visual tests.");
  for (const name of names) {
    const details: string[] = [];
    let ok = true;
    const layoutFile = join(baseDir, `${name}.layout.json`);
    const imageFile = join(baseDir, `${name}.png`);
    const actualFile = join(outDir, `${name}.actual.png`);
    const diffFile = join(outDir, `${name}.diff.png`);
    try {
      const xml = addBackdrop(examples[name]!());
      const shown = await bridge.show(name, xml, { hideOthers: true, waitFrames: 30 });
      if (/<script\b/i.test(xml) && !shown.scriptRunning)
        throw new Error("page has a script but scriptRunning is false");
      const layout = JSON.stringify(layoutSnapshot(shown.tree), null, 2) + "\n";
      if (update) await writeFile(layoutFile, layout);
      else {
        try {
          const baseline = JSON.parse(await readFile(layoutFile, "utf8"));
          const changes = treeDiff(baseline, layoutSnapshot(shown.tree));
          if (changes.length) {
            ok = false;
            details.push(...changes.slice(0, 30));
          }
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
          ok = false;
          details.push("Missing layout baseline; run with --update.");
        }
      }
      const shot = await bridge.screenshot({ width: 1920, height: 1080 });
      const windowsPath = execFileSync("wslpath", ["-u", shot.path]).toString().trim();
      let decoded;
      try {
        decoded = decodeTga(new Uint8Array(await readFile(windowsPath)));
      } finally {
        await rm(windowsPath, { force: true });
      }
      const actual = new PNG({ width: decoded.width, height: decoded.height });
      actual.data = Buffer.from(decoded.pixels);
      await writeFile(actualFile, PNG.sync.write(actual));
      if (update) await writeFile(imageFile, PNG.sync.write(actual));
      else {
        try {
          const baseline = PNG.sync.read(await readFile(imageFile));
          if (baseline.width !== actual.width || baseline.height !== actual.height)
            throw new Error("Screenshot dimensions differ");
          const diff = new PNG({ width: actual.width, height: actual.height });
          const count = pixelmatch(
            baseline.data,
            actual.data,
            diff.data,
            actual.width,
            actual.height,
            { threshold: 0.1 },
          );
          await writeFile(diffFile, PNG.sync.write(diff));
          if (count / (actual.width * actual.height) > 0.001) {
            ok = false;
            details.push(
              `Screenshot differs: ${count} pixels (${((100 * count) / (actual.width * actual.height)).toFixed(3)}%).`,
            );
          }
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
          ok = false;
          details.push("Missing screenshot baseline; run with --update.");
        }
      }
    } catch (error) {
      ok = false;
      details.push(error instanceof Error ? error.message : String(error));
    }
    reports.push({ name, ok, details });
    console.log(
      `${ok ? "PASS" : "FAIL"} ${name}${details.length ? `\n  ${details.join("\n  ")}` : ""}`,
    );
    if (interrupted) break;
  }
} catch (error) {
  reports.push({
    name: "setup",
    ok: false,
    details: [error instanceof Error ? error.message : String(error)],
  });
  console.error(reports.at(-1)!.details[0]);
} finally {
  try {
    await bridge.clear();
  } catch (error) {
    console.error(`Could not clear test layers: ${String(error)}`);
  }
  const esc = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
  const cards = reports
    .map((r) => {
      const images = [`${r.name}.png`, `${r.name}.actual.png`, `${r.name}.diff.png`]
        .map((f) => {
          const src =
            f.endsWith(".png") && !f.includes("actual") && !f.includes("diff")
              ? `../${f}`
              : f.replace(`${r.name}.`, "");
          return `<figure><figcaption>${esc(f)}</figcaption><img src="${esc(src)}" /></figure>`;
        })
        .join("");
      return `<section><h2>${esc(r.name)} — ${r.ok ? "PASS" : "FAIL"}</h2><pre>${esc(r.details.join("\n"))}</pre><div>${images}</div></section>`;
    })
    .join("");
  await writeFile(
    join(outDir, "report.html"),
    `<!doctype html><meta charset="utf-8"><title>Visual test report</title><style>body{font:14px sans-serif}section{border-bottom:1px solid #aaa;padding:1em}section div{display:flex;gap:1em}img{width:320px}pre{white-space:pre-wrap}</style><h1>Visual tests: ${reports.filter((r) => r.ok).length}/${reports.length} passed</h1>${cards}`,
  );
}
const failed = reports.filter((r) => !r.ok).length;
console.log(
  `\n${reports.length - failed}/${reports.length} passed. Report: ${join(outDir, "report.html")}`,
);
if (failed || interrupted) process.exitCode = 1;
