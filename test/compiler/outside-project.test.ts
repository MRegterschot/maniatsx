import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
