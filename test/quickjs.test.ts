import { expect, test } from "bun:test";
import { build } from "esbuild";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import quickjsVariant from "@jitl/quickjs-wasmfile-release-sync";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { renderMapInfo, themedPresets } from "../examples/themed/map-info.tsx";
import { maniatsxEsbuildPlugin } from "../src/compiler/esbuild-plugin.ts";

const root = process.cwd();
const dir = path.join(root, "test/.quickjs-tmp");

test("themed map-info renders in QuickJS within sandbox limits", async () => {
  await mkdir(dir, { recursive: true });
  const entry = path.join(dir, "fixture.tsx");
  const outfile = path.join(dir, "bundle.js");
  await Bun.write(
    entry,
    `import { renderMapInfo, themedPresets } from "${path.join(root, "examples/themed/map-info.tsx")}";
export function renderPreset(id) { return renderMapInfo(themedPresets[id]); }`,
  );

  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "iife",
    globalName: "fixture",
    platform: "neutral",
    target: "es2022",
    plugins: [maniatsxEsbuildPlugin({ rootDir: root })],
    alias: {
      "maniatsx/client": path.join(root, "src/client/index.ts"),
      "maniatsx/jsx-runtime": path.join(root, "src/jsx-runtime.ts"),
      "maniatsx/theme": path.join(root, "src/theme.ts"),
      "maniatsx/maniascript": path.join(root, "src/maniascript/index.ts"),
      maniatsx: path.join(root, "src/index.ts"),
    },
  });

  const bundle = await readFile(outfile, "utf8");
  const module = await newQuickJSWASMModuleFromVariant(quickjsVariant as never);
  const runtime = module.newRuntime();
  runtime.setMemoryLimit(32 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  const context = runtime.newContext();
  let deadline = Number.POSITIVE_INFINITY;
  runtime.setInterruptHandler(() => performance.now() > deadline);

  const evaluate = (source: string, budgetMs: number) => {
    deadline = performance.now() + budgetMs;
    try {
      const result = context.evalCode(source, "map-info.js", { type: "global" });
      if (result.error) {
        const message = context.dump(result.error);
        result.error.dispose();
        throw new Error(String(message));
      }
      return result.value;
    } finally {
      deadline = Number.POSITIVE_INFINITY;
    }
  };

  try {
    const startEval = performance.now();
    const evaluated = evaluate(bundle, 2000);
    const evalMs = performance.now() - startEval;
    evaluated.dispose();

    const renderMeasurements: number[] = [];
    for (const [id, theme] of Object.entries(themedPresets)) {
      const startRender = performance.now();
      const value = evaluate(`fixture.renderPreset(${JSON.stringify(id)})`, 100);
      const quickjsXml = value.consume((handle) => context.getString(handle));
      renderMeasurements.push(performance.now() - startRender);
      expect(quickjsXml).toBe(renderMapInfo(theme));
    }

    console.log(
      `[quickjs] bundle=${Buffer.byteLength(bundle)} bytes eval=${evalMs.toFixed(2)}ms renders=${renderMeasurements.map((ms) => `${ms.toFixed(2)}ms`).join(",")}`,
    );
  } finally {
    context.dispose();
    runtime.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
