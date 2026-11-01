import { describe, expect, test } from "bun:test";
import { escapeFormatting, stripFormatting } from "../src/text.ts";

describe("escapeFormatting", () => {
  test("doubles every dollar sign", () => {
    expect(escapeFormatting("$fffName")).toBe("$$fffName");
    expect(escapeFormatting("a$$b")).toBe("a$$$$b");
    expect(escapeFormatting("plain")).toBe("plain");
  });

  test("round-trips through stripFormatting", () => {
    expect(stripFormatting(escapeFormatting("$o$f00 a$$b"))).toBe("$o$f00 a$$b");
  });
});

describe("stripFormatting", () => {
  test("removes colors", () => {
    expect(stripFormatting("$f00Red$0F0Green")).toBe("RedGreen");
  });

  test("removes single-letter codes, case-insensitive", () => {
    expect(stripFormatting("$oB$iI$wW$nN$tT$sS$gG$zZ$mM")).toBe("BIWNTSGZM");
    expect(stripFormatting("$OBold$Z")).toBe("Bold");
    expect(stripFormatting("$<Name$>")).toBe("Name");
  });

  test("removes link markers with optional targets", () => {
    expect(stripFormatting("$l[maniaplanet://x]Link$l")).toBe("Link");
    expect(stripFormatting("$hClick$h")).toBe("Click");
    expect(stripFormatting("$p[tm://a]P$p")).toBe("P");
  });

  test("$$ becomes a literal dollar and is not re-parsed", () => {
    expect(stripFormatting("cost $$5")).toBe("cost $5");
    expect(stripFormatting("$$o")).toBe("$o");
    expect(stripFormatting("$$$o")).toBe("$");
  });

  test("leaves plain text alone", () => {
    expect(stripFormatting("hello world")).toBe("hello world");
  });
});
