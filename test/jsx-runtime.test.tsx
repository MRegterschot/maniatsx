import { expect, test } from "bun:test";
import { jsxDEV, Fragment as DevFragment } from "../src/jsx-dev-runtime.ts";
import { Fragment, jsx, jsxs } from "../src/jsx-runtime.ts";
import { VNODE } from "../src/vnode.ts";

test("jsx creates a frozen VNode with children inside props", () => {
  const node = jsx("frame", { id: "a", children: "x" }, "k1");
  expect(node.$$typeof).toBe(VNODE);
  expect(node.type).toBe("frame");
  expect(node.props).toEqual({ id: "a", children: "x" });
  expect(node.key).toBe("k1");
  expect(Object.isFrozen(node)).toBe(true);
});

test("key defaults to null; jsxs and jsxDEV behave like jsx", () => {
  expect(jsx("frame", {}).key).toBeNull();
  expect(jsxs("frame", {}, 3).key).toBe(3);
  const dev = jsxDEV("frame", { a: 1 }, "k", true, { fileName: "x" }, undefined);
  expect(dev.key).toBe("k");
  expect(dev.props).toEqual({ a: 1 });
  expect(DevFragment).toBe(Fragment);
});

test("JSX syntax compiles through the runtime", () => {
  const node = (
    <frame id="a">
      <quad />
    </frame>
  );
  expect(node.type).toBe("frame");
  expect((node.props as any).id).toBe("a");
});

const Item = (_: {}) => null;

test("fragments and keys via JSX", () => {
  const node = (
    <>
      <Item key="q" />
    </>
  );
  expect(node.type).toBe(Fragment);
});
