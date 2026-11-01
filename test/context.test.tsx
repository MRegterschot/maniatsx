import { describe, expect, test } from "bun:test";
import { createContext, useContext } from "../src/context.ts";
import { render } from "../src/render.ts";

const Theme = createContext("default");

function Show() {
  return <label text={useContext(Theme)} />;
}

describe("context", () => {
  test("has id, defaultValue and Provider", () => {
    expect(typeof Theme.id).toBe("symbol");
    expect(Theme.defaultValue).toBe("default");
    expect(typeof Theme.Provider).toBe("function");
  });

  test("falls back to the default value", () => {
    expect(render(<Show />)).toBe('<label text="default" />');
  });

  test("provider supplies a value to descendants", () => {
    expect(
      render(
        <Theme.Provider value="dark">
          <frame>
            <Show />
          </frame>
        </Theme.Provider>,
      ),
    ).toBe('<frame><label text="dark" /></frame>');
  });

  test("nested providers shadow and then restore", () => {
    const xml = render(
      <Theme.Provider value="outer">
        <Show />
        <Theme.Provider value="inner">
          <Show />
        </Theme.Provider>
        <Show />
      </Theme.Provider>,
    );
    expect(xml).toBe('<label text="outer" /><label text="inner" /><label text="outer" />');
  });

  test("independent contexts do not interfere", () => {
    const Other = createContext(1);
    function Both() {
      return <label text={`${useContext(Theme)}-${useContext(Other)}`} />;
    }
    expect(
      render(
        <Theme.Provider value="a">
          <Other.Provider value={2}>
            <Both />
          </Other.Provider>
        </Theme.Provider>,
      ),
    ).toBe('<label text="a-2" />');
  });

  test("render options seed context values; providers still override", () => {
    expect(render(<Show />, { contexts: [[Theme, "seeded"]] })).toBe('<label text="seeded" />');
    expect(
      render(
        <Theme.Provider value="local">
          <Show />
        </Theme.Provider>,
        { contexts: [[Theme, "seeded"]] },
      ),
    ).toBe('<label text="local" />');
  });

  test("useContext outside a render throws", () => {
    expect(() => useContext(Theme)).toThrow(/render/);
  });

  test("render state is cleaned up after a failed render", () => {
    expect(() => render(jsx_throw())).toThrow();
    expect(() => useContext(Theme)).toThrow(/render/);
  });

  test("nested render() calls do not leak context", () => {
    function Inner() {
      return <label text={render(<Show />)} />;
    }
    expect(
      render(
        <Theme.Provider value="outer">
          <Inner />
        </Theme.Provider>,
      ),
    ).toBe('<label text="&lt;label text=&quot;default&quot; /&gt;" />');
  });
});

function jsx_throw() {
  function Boom(): never {
    throw new Error("boom");
  }
  return <Boom />;
}
