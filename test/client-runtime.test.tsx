import { describe, expect, test } from "bun:test";
import { Manialink, render } from "../src/index.ts";
import { __mtx, action, type CompiledCode, type MsType } from "../src/client/index.ts";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

const code = (text: string): CompiledCode => ({
  code: [text],
  holes: [],
  includes: [],
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
      ...code("Integer Mtx_F_test() { return 1; }"),
      includes: [["MathLib", "MathLib"]],
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
