import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileSource } from "../../src/compiler/index.ts";

// Plugin projects don't install maniatsx: the compiler must resolve its own client API
test("compiles client code in a project without maniatsx installed", () => {
  const dir = mkdtempSync(join(tmpdir(), "mtx-outside-"));
  try {
    const source = `import { client, type Integer } from "maniatsx/client";
export const count = client.state<Integer>(0);`;
    const result = compileSource(join(dir, "widget.tsx"), source, { rootDir: dir });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("__mtx.state");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The vendored package has only dist/: the analyzer must recognise the built typings too.
// The copy sits under test/compiler/.tmp so dependencies still resolve, but no src/ is beside it.
test("recognises client calls against the built typings", async () => {
  const pkg = new URL("./.tmp/dist-only", import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), "mtx-dist-"));
  try {
    rmSync(pkg, { recursive: true, force: true });
    cpSync(new URL("../../dist", import.meta.url).pathname, join(pkg, "dist"), { recursive: true });
    const { compileSource: fromDist } = await import(join(pkg, "dist/compiler/index.js"));
    const source = `import { client, type Integer } from "maniatsx/client";
export const count = client.state<Integer>(0);`;
    const result = fromDist(join(dir, "widget.tsx"), source, { rootDir: dir });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("__mtx.state");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(pkg, { recursive: true, force: true });
  }
});

// Hosts hand out actions through helpers (gocontrolpanel's ctx.ui.action), not only action()
test("treats any value typed Action as an action handle", () => {
  const dir = mkdtempSync(join(tmpdir(), "mtx-action-"));
  try {
    const source = `import { client, type Action } from "maniatsx/client";
declare const host: { action(name: string): Action };
const pick = host.action("demo:pick");
export const onPick = client.handler(() => { pick.trigger("42"); });`;
    const result = compileSource(join(dir, "widget.tsx"), source, { rootDir: dir });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("__mtx.handler");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
