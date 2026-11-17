import { afterAll, expect, test } from "bun:test";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { maniatsxEsbuildPlugin } from "../src/compiler/esbuild-plugin.ts";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

const root = process.cwd();
const dir = path.join(root, "test/compiler/.esbuild-tmp");
afterAll(() => rm(dir, { recursive: true, force: true }));

test("esbuild compiles client handlers and reports located errors", async () => {
  await mkdir(dir, { recursive: true });
  const entry = path.join(dir, "fixture.tsx");
  const outfile = path.join(dir, "bundle.js");
  await Bun.write(
    entry,
    `import { client, type Integer } from "maniatsx/client";
import { Manialink, render } from "maniatsx";
export function Widget() {
 const count = client.state<Integer>(1, { persist: true, key: "count" });
 return <label text="click" onClick={client.handler(() => { count.value += 1; })} />;
}
export { Manialink, render };`,
  );
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    plugins: [maniatsxEsbuildPlugin({ rootDir: root, keyPrefix: "fixture" })],
    alias: {
      "maniatsx/client": path.join(root, "src/client/index.ts"),
      "maniatsx/jsx-runtime": path.join(root, "src/jsx-runtime.ts"),
      maniatsx: path.join(root, "src/index.ts"),
    },
  });
  const bundle = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  const xml = bundle.render(
    <bundle.Manialink id="esbuild">
      <bundle.Widget />
    </bundle.Manialink>,
  );
  const script = extractScripts(xml).join("\n");
  expect(script).toContain("Mtx_P_fixture_count for Page = 1;");
  expect(script).toContain("Mtx_P_fixture_count += 1;");
  expect(script).toContain("Mtx_P_fixture_count");
  expect(parseManiaScript(script).errors).toEqual([]);

  await Bun.write(
    entry,
    `import { client } from "maniatsx/client";\nclient.handler(() => { missing.value = 1; });`,
  );
  try {
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "esm",
      platform: "neutral",
      plugins: [maniatsxEsbuildPlugin({ rootDir: root })],
    });
    throw new Error("expected esbuild failure");
  } catch (error) {
    const errors = (error as { errors?: { location?: { file?: string; line?: number } }[] }).errors;
    expect(errors?.[0]?.location?.file).toContain("fixture.tsx");
    expect(errors?.[0]?.location?.line).toBe(2);
  }
});
