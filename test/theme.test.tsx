import { describe, expect, test } from "bun:test";
import { render } from "../src/render.ts";
import { Anchored, anchorPos, createThemeKit, override, slot, useLayout } from "../src/theme.ts";
import type { Component } from "../src/vnode.ts";

const kit = createThemeKit({
  id: "theme-test-base",
  name: "Base",
  tokens: { colors: { bg: "000", fg: "fff" }, spacing: [1, 2] },
  text: { hello: "Hello" },
});

describe("theme kit", () => {
  test("merges tokens, text, layout and components, and inherits variant chain", () => {
    const Panel = slot<{ value: string }>(
      "test/theme/panel",
      ({ value }) => <label text={`default-${value}`} />,
      {
        "theme-test-base": ({ value }) => <label text={`base-${value}`} />,
      },
    );
    const Custom: Component<{ value: string; Default: Component<{ value: string }> }> = ({
      value,
      Default,
    }) => (
      <frame>
        <Default value={value} />
        <label text="custom" />
      </frame>
    );
    const child = kit.defineTheme({
      id: "theme-test-child",
      name: "Child",
      tokens: { colors: { bg: "111" } },
      text: { hello: "Hi" },
      layout: { box: { anchor: "top-left", margin: [3, 4] } },
      components: [override(Panel, Custom)],
    });
    expect(child.tokens).toEqual({ colors: { bg: "111", fg: "fff" }, spacing: [1, 2] });
    expect(child.text.hello).toBe("Hi");
    expect(child.chain).toEqual(["theme-test-child", "theme-test-base"]);
    expect(Object.isFrozen(child.tokens.colors)).toBe(true);
    expect(
      render(
        <kit.ThemeProvider theme={child}>
          <Panel value="x" />
        </kit.ThemeProvider>,
      ),
    ).toBe('<frame><label text="default-x" /><label text="custom" /></frame>');
  });

  test("resolves variant by chain and returns base outside a provider", () => {
    const Variant = slot("test/theme/variant", () => <label text="default" />, {
      "theme-test-base": () => <label text="base" />,
    });
    const Read = () => <label text={kit.useText("hello")} />;
    expect(
      render(
        <>
          <Variant />
          <Read />
        </>,
      ),
    ).toBe('<label text="default" /><label text="Hello" />');
    expect(
      render(
        <kit.ThemeProvider theme={kit.base}>
          <Variant />
        </kit.ThemeProvider>,
      ),
    ).toBe('<label text="base" />');
  });

  test("supports nested providers and override receives Default", () => {
    const Panel = slot("test/theme/nested", () => <label text="outer-default" />);
    const Outer = kit.defineTheme({
      id: "theme-test-outer",
      name: "Outer",
      components: [
        override(Panel, ({ Default }) => (
          <frame>
            <Default />
          </frame>
        )),
      ],
    });
    const Inner = kit.defineTheme({ id: "theme-test-inner", name: "Inner" });
    expect(
      render(
        <kit.ThemeProvider theme={Outer}>
          <Panel />
          <kit.ThemeProvider theme={Inner}>
            <Panel />
          </kit.ThemeProvider>
        </kit.ThemeProvider>,
      ),
    ).toBe('<frame><label text="outer-default" /></frame><label text="outer-default" />');
  });

  test("serializes themes as data and resolves data chain, text and layout", () => {
    const Variant = slot("test/theme/data-variant", () => <label text="default" />, {
      "theme-test-base": () => <label text="ancestor" />,
    });
    const source = kit.defineTheme({
      id: "theme-test-data",
      name: "Data",
      text: { hello: "Data hello" },
      layout: { card: { anchor: "bottom-right", scale: 2 } },
    });
    const data = JSON.parse(JSON.stringify(kit.toData(source)));
    expect(data).toEqual(kit.toData(source));
    const Probe = () => (
      <>
        <Variant />
        <label text={kit.useText("hello")} />
        <frame pos={useLayout("card", { anchor: "center", size: [10, 6] }).pos} />
      </>
    );
    expect(
      render(
        <kit.ThemeProvider theme={data}>
          <Probe />
        </kit.ThemeProvider>,
      ),
    ).toBe('<label text="ancestor" /><label text="Data hello" /><frame pos="140 -78" />');
    expect(() =>
      render(
        <kit.ThemeProvider theme={{ ...data, chain: ["wrong"] }}>
          <Probe />
        </kit.ThemeProvider>,
      ),
    ).toThrow(/Invalid ThemeData/);
  });

  test("rejects duplicate ids and slot names", () => {
    expect(() => kit.defineTheme({ id: "theme-test-child", name: "Duplicate" })).toThrow(
      /Duplicate theme id/,
    );
    slot("test/theme/duplicate", () => null);
    expect(() => slot("test/theme/duplicate", () => null)).toThrow(/Duplicate theme slot/);
  });
});

test("anchorPos covers all anchors, margins, scales and rounds to three decimals", () => {
  const base = { size: [20, 10] as const, margin: [2, 3] as const, scale: 1.5 };
  expect(anchorPos({ ...base, anchor: "top-left" })).toEqual([-158, 87]);
  expect(anchorPos({ ...base, anchor: "top" })).toEqual([-13, 87]);
  expect(anchorPos({ ...base, anchor: "top-right" })).toEqual([128, 87]);
  expect(anchorPos({ ...base, anchor: "left" })).toEqual([-158, 10.5]);
  expect(anchorPos({ ...base, anchor: "center" })).toEqual([-13, 10.5]);
  expect(anchorPos({ ...base, anchor: "right" })).toEqual([128, 10.5]);
  expect(anchorPos({ ...base, anchor: "bottom-left" })).toEqual([-158, -72]);
  expect(anchorPos({ ...base, anchor: "bottom" })).toEqual([-13, -72]);
  expect(anchorPos({ ...base, anchor: "bottom-right" })).toEqual([128, -72]);
  expect(anchorPos({ anchor: "center", size: [1, 1], margin: [0, 0], scale: 1 / 3 })).toEqual([
    -0.167, 0.167,
  ]);
});

test("Anchored emits frame attributes and useLayout uses themed layout", () => {
  const custom = kit.defineTheme({
    id: "theme-test-layout",
    name: "Layout",
    layout: { card: { anchor: "bottom-right", scale: 2, hidden: true } },
  });
  const Probe = () => {
    const result = useLayout("card", { anchor: "center", size: [10, 6] });
    return <frame pos={result.pos} />;
  };
  expect(
    render(
      <CustomProvider theme={custom}>
        <Probe />
        <Anchored name="card" layout={{ anchor: "center", size: [10, 6] }} id="card" z-index={4}>
          <label text="x" />
        </Anchored>
      </CustomProvider>,
    ),
  ).toBe(
    '<frame pos="140 -78" /><frame id="card" pos="140 -78" scale="2" hidden="1" z-index="4"><label text="x" /></frame>',
  );
});

const CustomProvider = kit.ThemeProvider;

// @ts-expect-error unknown token key
kit.defineTheme({ id: "bad-token", name: "Bad", tokens: { unknown: 1 } });
const TypeSlot = slot<{ value: string }>("test/theme/types", () => null);
// @ts-expect-error override implementation must accept slot props
override(TypeSlot, (_props: { nope: number; Default: Component<{ value: string }> }) => null);
// @ts-expect-error unknown anchor
anchorPos({ anchor: "middle", size: [1, 1] });
