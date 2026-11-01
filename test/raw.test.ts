import { expect, test } from "bun:test";
import { raw } from "../src/raw.ts";
import { RAW_XML } from "../src/vnode.ts";

test("raw creates a frozen RawXml", () => {
  const r = raw("<a/>");
  expect(r.$$typeof).toBe(RAW_XML);
  expect(r.xml).toBe("<a/>");
  expect(Object.isFrozen(r)).toBe(true);
});

test("raw rejects non-strings", () => {
  expect(() => raw(1 as any)).toThrow();
});
