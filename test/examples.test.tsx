import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { examples } from "../examples/index.ts";

const GOLDEN = new URL("./golden/", import.meta.url);
const update = process.env.UPDATE_GOLDEN === "1";

describe("example golden files", () => {
  for (const [name, renderExample] of Object.entries(examples)) {
    test(name, () => {
      const xml = renderExample({ pretty: true }) + "\n";
      const file = new URL(`${name}.xml`, GOLDEN);
      if (update) {
        mkdirSync(GOLDEN, { recursive: true });
        writeFileSync(file, xml);
      }
      expect(xml).toBe(readFileSync(file, "utf8"));
    });
  }

  test("compact and pretty output differ only in whitespace outside the script", () => {
    for (const renderExample of Object.values(examples)) {
      const strip = (xml: string) =>
        xml.replace(/<script>[\s\S]*<\/script>/, "").replace(/\s+/g, "");
      expect(strip(renderExample())).toBe(strip(renderExample({ pretty: true })));
    }
  });
});
