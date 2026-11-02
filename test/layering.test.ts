import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

// Phase 1 is vendored on its own (gocontrolpanel), so it may only reference the type-only contract
test("phase 1 sources don't import phase 2 code", () => {
  const core = readdirSync("src").filter((f) => /\.tsx?$/.test(f) && f !== "cli.ts");
  const offenders: string[] = [];
  for (const file of core) {
    const source = readFileSync(`src/${file}`, "utf8");
    // Any path literal counts: static imports, re-exports and inline import() types
    for (const [line] of source.matchAll(
      /^.*["']\.\/(client|compiler|maniascript)\/[^"']*["'].*$/gm,
    )) {
      if (/^import type \{[^}]*\} from "\.\/client\/contract\.ts";$/.test(line.trim())) continue;
      offenders.push(`${file}: ${line.trim()}`);
    }
  }
  expect(offenders).toEqual([]);
});
