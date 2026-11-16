import { describe, expect, test } from "bun:test";
import { Manialink, Script, render } from "../src/index.ts";
import { __mtx, action, type CompiledCode, type MsType } from "../src/client/index.ts";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

const code = (text: string): CompiledCode => ({
  code: [text],
  holes: [],
  structs: [],
  site: "test",
});
const value = (type: MsType, v: unknown): CompiledCode => ({
  ...code(""),
  code: ["", ""],
  holes: [{ kind: "value", type, get: () => v }],
});
function page(node: Parameters<typeof render>[0]) {
  const xml = render(<Manialink id="test">{node}</Manialink>);
  for (const script of extractScripts(xml)) expect(parseManiaScript(script).errors).toEqual([]);
  return xml;
}
describe("client runtime", () => {
  test("counter, state and action dispatch", () => {
    const count = __mtx.state("Integer", value("Integer", 1), "test");
    const reset = action("reset");
    const expr: CompiledCode = {
      ...code(""),
      code: ['"Count: " ^ ', ""],
      holes: [{ kind: "state", get: () => count }],
    };
    const body: CompiledCode = {
      ...code(""),
      code: ["", " += 1; Mtx_Dirty = True; TriggerPageAction(", ");"],
      holes: [
        { kind: "state", get: () => count },
        { kind: "action", get: () => reset },
      ],
    };
    const handler = __mtx.handler(body);
    const xml = page(
      <frame>
        <label text={__mtx.bind("Text", expr)} />
        <quad onClick={handler} />
        <quad onClick={handler} />
      </frame>,
    );
    expect(xml).toContain('id="mtx-1"');
    expect(xml).toContain('scriptevents="1"');
    expect(xml).toContain("declare Integer Mtx_S1;");
    expect(xml).toContain("Mtx_S1 = 1;");
    expect(xml.match(/Void Mtx_H1\(\)/g)).toHaveLength(1);
    expect(xml).toContain('TriggerPageAction("reset")');
    expect(xml).toContain("Mtx_Dirty = False;");
  });
  test("events and bindings", () => {
    const handler = __mtx.handler(code('log("ok");'));
    const xml = page(
      <frame>
        <label
          onClick={handler}
          onRightClick={handler}
          onMouseOver={handler}
          onMouseOut={handler}
          text={__mtx.bind("Text", code('"x"'))}
          hidden={__mtx.bind("Boolean", code("False"))}
          opacity={__mtx.bind("Real", code("1."))}
          pos={__mtx.bind("Vec2", code("<1., 2.>"))}
        />
        <entry onSubmit={handler} default={__mtx.bind("Text", code('"x"'))} />
        <gauge ratio={__mtx.bind("Real", code("1."))} />
        <quad
          image={__mtx.bind("Text", code('"url"'))}
          bgcolor={__mtx.bind("Text", code('"ffffff"'))}
        />
      </frame>,
    );
    for (const event of ["MouseClick", "MouseRightClick", "MouseOver", "MouseOut", "EntrySubmit"])
      expect(xml).toContain(`Type::${event}`);
    for (const property of [
      ".Value",
      ".Visible",
      ".Opacity",
      ".Ratio",
      ".ChangeImageUrl",
      ".BgColor",
    ])
      expect(xml).toContain(property);
    expect(xml).toContain("ColorLib::HexToRgb");
  });
  test("typed literals and function requirements", () => {
    const fn = __mtx.fn("Mtx_F_test", {
      ...code(""),
      code: ["Integer Mtx_F_test() { return ", "::Abs(1); }"],
      holes: [{ kind: "lib", lib: "MathLib" }],
      structs: ["#Struct K_Test { Integer X; }"],
    });
    const holes = [
      value("Integer", 1),
      value("Real", 1),
      value("Boolean", true),
      value("Text", "a--b"),
      value("Vec2", { X: 1, Y: 2 }),
      value("Vec3", { X: 1, Y: 2, Z: 3 }),
      value("Int2", { X: 1, Y: 2 }),
      value("Int3", { X: 1, Y: 2, Z: 3 }),
      value({ array: "Real" }, [1, 2]),
      value({ record: { key: "Text", value: "Integer" } }, { a: 1 }),
    ];
    const expr: CompiledCode = {
      ...code(""),
      code: ["Mtx_F_test(", ")"],
      holes: [{ kind: "fn", get: () => fn }],
    };
    const xml = page(
      <frame>
        {holes.map((h) => (
          <label text={__mtx.bind("Text", h)} />
        ))}
        <label text={__mtx.bind("Text", expr)} />
      </frame>,
    );
    expect(xml).toContain('"a-" ^ "-b"');
    expect(xml).toContain("[1., 2.]");
    expect(xml).toContain("#Struct K_Test");
    expect(xml).toContain('#Include "MathLib" as MathLib');
    expect(xml).toContain("return MathLib::Abs(1);");
  });
  test("lib holes reuse the page's alias, whatever the include order", () => {
    const abs: CompiledCode = {
      ...code(""),
      code: ["", "::Abs(-1)"],
      holes: [{ kind: "lib", lib: "MathLib" }],
    };

    for (const before of [true, false]) {
      const include = <Script.Include lib="MathLib" as="ML" />;
      const xml = page(
        <>
          {before && include}
          <label text={__mtx.bind("Integer", abs)} />
          {!before && include}
        </>,
      );

      expect(xml).toContain('#Include "MathLib" as ML');
      expect(xml).not.toContain("as MathLib");
      expect(xml).toContain("ML::Abs(-1)");
      expect(xml).not.toContain("\0");
    }
  });
  test("rejects invalid placement and struct values", () => {
    expect(() => render(<label text={__mtx.bind("Text", code('"x"'))} />)).toThrow("Manialink");
    expect(() => page(<label size={__mtx.bind("Text", code('"x"')) as never} />)).toThrow(
      'attribute "size"',
    );
    expect(() =>
      page(<label text={__mtx.bind("Text", value({ struct: "K_Test" }, {}))} />),
    ).toThrow("not supported yet");
  });
});

describe("lead fixes", () => {
  test("pos binding assigns the Vec2 directly and bind-only elements get no scriptevents", () => {
    const xml = page(<label pos={__mtx.bind("Vec2", code("<1., 2.>"))} />);
    expect(xml).toContain("Mtx_C1.RelativePosition_V3 = <1., 2.>;");
    expect(xml).not.toContain("scriptevents");
  });
});

describe("persisted state", () => {
  const stateExpr = (s: ReturnType<typeof __mtx.state>): CompiledCode => ({
    ...code(""),
    code: ["", ""],
    holes: [{ kind: "state", get: () => s }],
  });
  const writeBody = (s: ReturnType<typeof __mtx.state>): CompiledCode => ({
    ...code(""),
    code: ["", " = !", ";\nMtx_Dirty = True;"],
    holes: [
      { kind: "state", get: () => s },
      { kind: "state", get: () => s },
    ],
  });

  test("declares for Page in main and re-binds in handlers and fns", () => {
    const open = __mtx.state("Boolean", value("Boolean", false), "src/widget.tsx:3:9", {
      persist: true,
    });
    const fn = __mtx.fn("Mtx_F_flip", {
      ...code(""),
      code: ["Void Mtx_F_flip() {\n  ", " = !", ";\n}"],
      holes: [
        { kind: "state", get: () => open },
        { kind: "state", get: () => open },
      ],
    });
    const callFn: CompiledCode = {
      ...code(""),
      code: ["", "();"],
      holes: [{ kind: "fn", get: () => fn }],
    };
    const xml = page(
      <frame>
        <quad onClick={__mtx.handler(writeBody(open))} />
        <quad onRightClick={__mtx.handler(callFn)} />
      </frame>,
    );
    const name = xml.match(/Mtx_P_widget_[0-9a-f]{8}/)![0];
    expect(xml).toContain(`  declare Boolean ${name} for Page = False;`);
    expect(xml).toContain(
      `Void Mtx_H1() {\ndeclare Boolean ${name} for Page;\n${name} = !${name};`,
    );
    expect(xml).toContain(
      `Void Mtx_F_flip() {\n  declare Boolean ${name} for Page;\n  ${name} = !${name};`,
    );
    // No global declaration, no re-assignment of the initial value
    expect(xml).not.toMatch(/declare Boolean Mtx_P_\w+;/);
    expect(xml.match(/= False/g)).toHaveLength(1);
    expect(xml).not.toContain("Mtx_S1");
  });

  test("the name is stable, depends on the site and honours an explicit key", () => {
    const make = (site: string, options: { persist: true; key?: string }) => {
      const s = __mtx.state("Integer", value("Integer", 1), site, options);
      return page(<label onClick={__mtx.handler(writeBody(s))} />);
    };
    const a = make("src/a.tsx:1:1", { persist: true });
    expect(make("src/a.tsx:1:1", { persist: true })).toBe(a);
    expect(make("src/a.tsx:2:1", { persist: true })).not.toBe(a);
    expect(make("src/a.tsx:1:1", { persist: true, key: "open" })).toContain(
      "declare Integer Mtx_P_open for Page = 1;",
    );
  });

  test("the same site rendered twice gets distinct names; duplicate keys throw", () => {
    const make = (options: { persist: true; key?: string }) =>
      __mtx.state("Integer", value("Integer", 1), "src/a.tsx:1:1", options);
    const twice = (options: { persist: true; key?: string }) => {
      const [x, y] = [make(options), make(options)];
      return page(
        <frame>
          <label onClick={__mtx.handler(writeBody(x))} />
          <label onClick={__mtx.handler(writeBody(y))} />
        </frame>,
      );
    };
    const xml = twice({ persist: true });
    expect(xml.match(/declare Integer Mtx_P_a_[0-9a-f]{8}(_2)? for Page = 1;/g)).toHaveLength(2);
    expect(() => twice({ persist: true, key: "k" })).toThrow('persist key "k"');
    expect(() =>
      page(<label onClick={__mtx.handler(writeBody(make({ persist: true, key: "1x" })))} />),
    ).toThrow("invalid persist key");
  });

  test("bindings read it from main and still use the dirty flag", () => {
    const n = __mtx.state("Integer", value("Integer", 4), "src/a.tsx:1:1", { persist: true });
    const body: CompiledCode = {
      ...code(""),
      code: ["", " += 1;\nMtx_Dirty = True;"],
      holes: [{ kind: "state", get: () => n }],
    };
    const xml = page(
      <frame>
        <label text={__mtx.bind("Integer", stateExpr(n))} onClick={__mtx.handler(body)} />
      </frame>,
    );
    expect(xml).toMatch(/declare Integer Mtx_P_a_[0-9a-f]{8} for Page = 4;/);
    expect(xml).toMatch(/Mtx_C1\.Value = Mtx_P_a_[0-9a-f]{8};/);
    expect(xml).toMatch(/if \(Mtx_Dirty\) \{ Mtx_C1\.Value = Mtx_P_a_[0-9a-f]{8}; \}/);
    expect(xml).toMatch(/\+= 1;\nMtx_Dirty = True;\n\}/);
  });
});

describe("dirty flag", () => {
  const dirtyBody: CompiledCode = {
    ...code(""),
    code: ["", " = 2;\nMtx_Dirty = True;"],
    holes: [{ kind: "state", get: () => count }],
  };
  const count = __mtx.state("Integer", value("Integer", 1), "test");

  test("is dropped when no binding reads state", () => {
    const xml = page(<quad onClick={__mtx.handler(dirtyBody)} />);
    expect(xml).toContain("Mtx_S1 = 2;");
    expect(xml).not.toContain("Mtx_Dirty");
  });

  test("is dropped from lifecycle blocks and inline writes too", () => {
    const Lifecycle = () => {
      __mtx.onInit(dirtyBody);
      __mtx.onFrame(dirtyBody);
      return null;
    };
    const xml = page(
      <frame>
        <quad onClick={__mtx.handler(code("a(); Mtx_Dirty = True; b();"))} />
        <Lifecycle />
      </frame>,
    );
    expect(xml).not.toContain("Mtx_Dirty");
    expect(xml).toContain("a();  b();");
    expect(xml).not.toContain("\0");
  });

  test("is kept, declared and polled when a binding exists", () => {
    const xml = page(
      <frame>
        <quad onClick={__mtx.handler(dirtyBody)} />
        <label
          text={__mtx.bind("Integer", {
            ...code(""),
            code: ["", ""],
            holes: [{ kind: "state", get: () => count }],
          })}
        />
      </frame>,
    );
    expect(xml).toContain("declare Boolean Mtx_Dirty;");
    expect(xml).toContain("Mtx_S1 = 2;\nMtx_Dirty = True;");
    expect(xml).toContain("if (Mtx_Dirty) {");
    expect(xml).toContain("Mtx_Dirty = False;");
  });
});
