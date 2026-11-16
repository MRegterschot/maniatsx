// Renders examples/themed/mockups.html headless and compares each theme with its in-game baseline.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const root = new URL("..", import.meta.url).pathname;
const fonts = join(root, "node_modules/.cache/maniatsx-fonts");
const out = join(root, "test/visual/.out/design");
const FONT_URLS: Record<string, string> = {
  "Montserrat-Regular.ttf":
    "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Regular.ttf",
  "Montserrat-SemiBold.ttf":
    "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-SemiBold.ttf",
  "fa-solid-900.ttf":
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-solid-900.ttf",
};

function browser(): string {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), ".cache/ms-playwright");
  const dir = existsSync(cache)
    ? readdirSync(cache).find((d) => d.startsWith("chromium_headless_shell"))
    : undefined;
  if (!dir)
    throw new Error(
      "No headless Chromium found; set CHROME or run `bunx playwright install chromium-headless-shell`",
    );
  const sub = readdirSync(join(cache, dir)).find((d) => d.startsWith("chrome-"))!;
  return join(cache, dir, sub, "chrome-headless-shell");
}

mkdirSync(fonts, { recursive: true });
mkdirSync(out, { recursive: true });
for (const [file, url] of Object.entries(FONT_URLS)) {
  if (existsSync(join(fonts, file))) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font download failed: ${url}`);
  writeFileSync(join(fonts, file), Buffer.from(await res.arrayBuffer()));
}

const filter = process.argv[2];
let failed = false;
for (const theme of ["default", "midnight", "compact", "paper"].filter(
  (t) => !filter || t.includes(filter),
)) {
  const shot = join(out, `${theme}.design.png`);
  const url = `file://${root}examples/themed/mockups.html?theme=${theme}&full=1&fonts=file://${fonts}`;
  execFileSync(
    browser(),
    [
      "--no-sandbox",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--window-size=1920,1080",
      "--virtual-time-budget=4000",
      `--screenshot=${shot}`,
      url,
    ],
    { stdio: "ignore" },
  );
  const design = PNG.sync.read(readFileSync(shot));
  const game = PNG.sync.read(readFileSync(join(root, `test/visual/scene-${theme}.png`)));
  const diff = new PNG({ width: 1920, height: 1080 });
  const bad = pixelmatch(design.data, game.data, diff.data, 1920, 1080, { threshold: 0.1 });
  writeFileSync(join(out, `${theme}.diff.png`), PNG.sync.write(diff));
  const pct = (bad / (1920 * 1080)) * 100;
  if (bad > 0) failed = true;
  console.log(
    `${theme.padEnd(9)} ${String(bad).padStart(6)} px differ (${pct.toFixed(3)}%)  ${join(out, `${theme}.diff.png`)}`,
  );
}
process.exit(failed ? 1 : 0);
