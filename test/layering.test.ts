import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

// Phase 1 is vendored on its own (gocontrolpanel), so it may only reference the type-only contract
test("phase 1 sources don't import phase 2 code", () => {
  const core = readdirSync("src").filter((f) => /\.tsx?$/.test(f) && f !== "cli.ts");
  const offenders: string[] = [];
  for (const file of core) {
    const source = readFileSync(`src/${file}`, "utf8");
    for (const [, kind, spec] of source.matchAll(/^import (type )?[^"]*"(\.\/[^"]+)"/gm)) {
      if (!/^\.\/(client|compiler|maniascript)\//.test(spec!)) continue;
      if (kind && spec === "./client/contract.ts") continue;
      offenders.push(`${file} -> ${spec}`);
    }
  }
  expect(offenders).toEqual([]);
});
