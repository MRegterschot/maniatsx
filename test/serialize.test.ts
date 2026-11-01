import { describe, expect, test } from "bun:test";
import { escapeAttribute, formatNumber, serializeValue } from "../src/serialize.ts";

describe("formatNumber", () => {
  test("trims float noise and trailing zeros", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(1.23456)).toBe("1.2346");
    expect(formatNumber(-12.5)).toBe("-12.5");
  });

  test("never uses exponent notation", () => {
    expect(formatNumber(1e21)).toBe("1000000000000000000000");
    expect(formatNumber(1e-7)).toBe("0");
    expect(formatNumber(-1e-7)).toBe("0");
    expect(formatNumber(1.5e22)).toBe("15000000000000000000000");
  });

  test("-0 becomes 0", () => {
    expect(formatNumber(-0)).toBe("0");
  });

  test("throws on non-finite numbers", () => {
    expect(() => formatNumber(NaN)).toThrow();
    expect(() => formatNumber(Infinity)).toThrow();
    expect(() => formatNumber(-Infinity)).toThrow();
  });
});

describe("escapeAttribute", () => {
  test("escapes XML specials and whitespace controls", () => {
    expect(escapeAttribute(`a&b<c>d"e'f\ng\rh\ti`)).toBe(
      "a&amp;b&lt;c&gt;d&quot;e&apos;f&#10;g&#13;h&#9;i",
    );
  });
});

describe("serializeValue", () => {
  test("omits null and undefined", () => {
    expect(serializeValue("quad", "x", null)).toBeNull();
    expect(serializeValue("quad", "x", undefined)).toBeNull();
  });

  test("booleans", () => {
    expect(serializeValue("quad", "hidden", true)).toBe("1");
    expect(serializeValue("quad", "hidden", false)).toBe("0");
  });

  test("vec2 tuples", () => {
    expect(serializeValue("quad", "pos", [1, -2.5])).toBe("1 -2.5");
    expect(serializeValue("quad", "pos", [0.1 + 0.2, -0])).toBe("0.3 0");
  });

  test("strings pass through unescaped", () => {
    expect(serializeValue("quad", "pos", "1 2")).toBe("1 2");
  });

  test("class joins strings and drops empties", () => {
    expect(serializeValue("quad", "class", "a b")).toBe("a b");
    expect(serializeValue("quad", "class", ["a", "", "b"])).toBe("a b");
    expect(serializeValue("quad", "class", [])).toBeNull();
    expect(serializeValue("quad", "class", ["", ""])).toBeNull();
  });

  test("throws on objects and functions, naming element and attribute", () => {
    expect(() => serializeValue("quad", "size", {})).toThrow(/<quad> attribute "size"/);
    expect(() => serializeValue("label", "text", () => 1)).toThrow(/<label> attribute "text"/);
    expect(() => serializeValue("quad", "size", ["a", "b"])).toThrow(/"size"/);
  });

  test("throws on non-finite numbers with context", () => {
    expect(() => serializeValue("quad", "z-index", NaN)).toThrow(/<quad> attribute "z-index"/);
    expect(() => serializeValue("quad", "pos", [1, Infinity])).toThrow(/"pos"/);
  });
});
