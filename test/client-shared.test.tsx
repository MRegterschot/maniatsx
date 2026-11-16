import { describe, expect, test } from "bun:test";
import { Manialink, render } from "../src/index.ts";
import { __mtx, Publish, type CompiledCode, type MsType } from "../src/client/index.ts";
import { compileSource } from "../src/compiler/index.ts";
import { renderSharedData, renderSharedDataUpdate } from "../examples/shared-data.tsx";
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

const count = __mtx.shared<number>("count", "Integer", value("Integer", 0), "src/a.tsx:1:1");
const read: CompiledCode = {
  ...code(""),
  code: ['"n=" ^ ', ""],
  holes: [{ kind: "shared", get: () => count }],
};
const flash: CompiledCode = {
  ...code(""),
  code: ["Mtx_Dirty = True;\nlog(", ");"],
  holes: [{ kind: "shared", get: () => count }],
};

describe("client.shared reader", () => {
  test("compares versions in the loop, refreshes bindings and runs watchers", () => {
    const Page = () => {
      __mtx.watch(count, flash);
      return <label text={__mtx.bind("Text", read)} />;
    };
    const xml = page(<Page />);
    expect(xml).toContain("  declare Integer Mtx_X_count for This = 0;");
    expect(xml).toContain("  declare Integer Mtx_X_count_V for This;");
    expect(xml).toContain("declare Integer Mtx_X_count_Seen;");
    expect(xml).toContain(
      [
        "    if (Mtx_X_count_V != Mtx_X_count_Seen) {",
        "      Mtx_X_count_Seen = Mtx_X_count_V;",
        "      Mtx_Dirty = True;",
        "      Mtx_H1();",
        "    }",
      ].join("\n"),
    );
    // The sync block runs before the binding refresh, so a change shows up in the same frame
    expect(xml.indexOf("Mtx_X_count_Seen = ")).toBeLessThan(xml.indexOf("if (Mtx_Dirty) {"));
    expect(xml).toContain('Mtx_C1.Value = "n=" ^ Mtx_X_count;');
    expect(xml).toContain(
      "Void Mtx_H1() {\ndeclare Integer Mtx_X_count for This;\nMtx_Dirty = True;\nlog(Mtx_X_count);",
    );
  });

  test("a page without bindings has no dirty flag, with or without a watcher", () => {
    const Watching = () => {
      __mtx.watch(count, flash);
      return null;
    };
    const xml = page(<Watching />);
    expect(xml).toContain("Mtx_X_count_V != Mtx_X_count_Seen");
    expect(xml).toContain("Mtx_H1();");
    expect(xml).not.toContain("Mtx_Dirty");
    expect(xml).not.toContain("\0");

    // Only reading the value in a handler needs neither the version nor the last-seen copy
    const handlerOnly = page(<quad onClick={__mtx.handler({ ...read, code: ["log(", ");"] })} />);
    expect(handlerOnly).toContain("declare Integer Mtx_X_count for This;\nlog(Mtx_X_count);");
    expect(handlerOnly).not.toContain("Mtx_X_count_V");
    expect(handlerOnly).not.toContain("Mtx_Dirty");
  });

  test("fns re-declare it and lifecycle code uses main's declaration", () => {
    const fn = __mtx.fn("Mtx_F_read", {
      ...code(""),
      code: ["Integer Mtx_F_read() {\n  return ", ";\n}"],
      holes: [{ kind: "shared", get: () => count }],
    });
    const Life = () => {
      __mtx.onInit({ ...read, code: ["log(", ");"] });
      return null;
    };
    const xml = page(
      <frame>
        <quad
          onClick={__mtx.handler({
            ...code(""),
            code: ["log(", "());"],
            holes: [{ kind: "fn", get: () => fn }],
          })}
        />
        <Life />
      </frame>,
    );
    expect(xml).toContain(
      "Integer Mtx_F_read() {\n  declare Integer Mtx_X_count for This;\n  return",
    );
    expect(xml.match(/declare Integer Mtx_X_count for This/g)).toHaveLength(2);
    expect(xml).toContain("log(Mtx_X_count);");
  });

  test("keys are validated and a key has one type", () => {
    const bad = (key: string) => __mtx.shared(key, "Integer", value("Integer", 0), "src/a.tsx:1:1");
    for (const key of ["1x", "a-b", "x_V", "x_Seen", ""]) {
      expect(() =>
        page(
          <label
            text={__mtx.bind("Text", { ...read, holes: [{ kind: "shared", get: () => bad(key) }] })}
          />,
        ),
      ).toThrow("invalid key");
    }
    const text = __mtx.shared("count", "Text", value("Text", ""), "src/b.tsx:2:2");
    expect(() =>
      page(
        <frame>
          <label text={__mtx.bind("Text", read)} />
          <label
            text={__mtx.bind("Text", { ...read, holes: [{ kind: "shared", get: () => text }] })}
          />
        </frame>,
      ),
    ).toThrow('key "count" is declared with two types');
  });
});

describe("<Publish>", () => {
  const point = {
    struct: "K_Point",
    fields: [
      { name: "label", type: "Text" },
      { name: "x", type: "Real" },
      { name: "tags", type: { array: "Integer" } },
    ],
  } as const satisfies MsType;
  const structs = ["#Struct K_Point {\n  Text label;\n  Real x;\n  Integer[] tags;\n}"];
  const shared = __mtx.shared<{ label: string; x: number; tags: number[] }>(
    "point",
    point,
    { ...value(point, { label: "", x: 0, tags: [] }), structs },
    "src/a.tsx:1:1",
  );

  test("assigns a literal and bumps the version in main", () => {
    const xml = page(<Publish to={shared} value={{ label: "a--b", x: 2, tags: [1, 2] }} />);
    expect(xml).toContain("#Struct K_Point");
    expect(xml).toContain("  declare K_Point Mtx_X_point for This;\n");
    expect(xml).toContain("  declare Integer Mtx_X_point_V for This;\n");
    expect(xml).toContain(
      '  Mtx_X_point = K_Point { label = "a-" ^ "-b", x = 2., tags = [1, 2] };\n  Mtx_X_point_V += 1;',
    );
    // Nothing is read here, so the initial value and version tracking stay out
    expect(xml).not.toContain("Mtx_X_point_Seen");
    expect(xml).not.toContain(' = K_Point { label = ""');
  });

  test("empty collections: typed literal at the top, omitted in structs, rejected inside arrays", () => {
    const empty = page(<Publish to={shared} value={{ label: "", x: 0, tags: [] }} />);
    expect(empty).toContain('Mtx_X_point = K_Point { label = "", x = 0. };');
    const ids = __mtx.shared<number[]>(
      "ids",
      { array: "Integer" },
      value({ array: "Integer" }, [1]),
      "src/a.tsx:2:1",
    );
    expect(page(<Publish to={ids} value={[]} />)).toContain("Mtx_X_ids = Integer[];");
    const grid = __mtx.shared<number[][]>(
      "grid",
      { array: { array: "Integer" } },
      value({ array: { array: "Integer" } }, [[1]]),
      "src/a.tsx:3:1",
    );
    expect(() => page(<Publish to={grid} value={[[]]} />)).toThrow("inside an array");
    expect(() => page(<Publish to={shared} value={{ label: "", x: 0, tags: [1.5] }} />)).toThrow();
    expect(() => page(<Publish to={shared} value={{ label: 1 } as never} />)).toThrow();
    expect(() => page(<Publish to={{} as never} value={1} />)).toThrow("client.shared handle");
    expect(() => render(<Publish to={shared} value={{ label: "", x: 0, tags: [] }} />)).toThrow(
      "Manialink",
    );
  });

  test("a page that reads and publishes declares the variable once, with its initial value", () => {
    const xml = page(
      <frame>
        <Publish to={count} value={5} />
        <label text={__mtx.bind("Text", read)} />
      </frame>,
    );
    expect(xml.match(/declare Integer Mtx_X_count for This/g)).toHaveLength(1);
    expect(xml).toContain("declare Integer Mtx_X_count for This = 0;");
    expect(xml).toContain("Mtx_X_count = 5;\n  Mtx_X_count_V += 1;");
  });
});

describe("example: reader and writer pages", () => {
  test("share variable names and both scripts parse", () => {
    const [main, update] = [renderSharedData(), renderSharedDataUpdate()];
    for (const xml of [main, update])
      for (const script of extractScripts(xml)) expect(parseManiaScript(script).errors).toEqual([]);
    expect(main).toContain(
      "declare K_MapSummary Mtx_X_example_map_summary for This = K_MapSummary",
    );
    expect(main).toContain("Mtx_X_example_map_summary_V != Mtx_X_example_map_summary_Seen");
    expect(update).toContain(
      'Mtx_X_example_map_summary = K_MapSummary { name = "A01 - Green Plains"',
    );
    expect(update).toContain("Mtx_X_example_map_summary_V += 1;");
    expect(update).not.toContain("Mtx_Dirty");
  });
});

describe("compiler", () => {
  const prefix = `import { client, type Integer } from "maniatsx/client";
const count = client.shared<Integer>("count", 0);
`;
  function diagnostics(body: string, header = prefix) {
    return compileSource("test/compiler/shared.tsx", `${header}${body}`).diagnostics;
  }

  test("writing a shared value is a compile error naming the node", () => {
    for (const write of [
      "count.value = 1;",
      "count.value += 1;",
      "count.value++;",
      "const xs = client.shared<Integer[]>('xs', [1]); xs.value.push(2);",
    ]) {
      const source = `${prefix}function C() { client.handler(() => { ${write} }); }`;
      const found = compileSource("test/compiler/shared.tsx", source).diagnostics;
      expect(found).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: "error",
            code: expect.stringMatching(/assign-shared|nested/),
          }),
        ]),
      );
    }
    const [one] = diagnostics("function C() { client.handler(() => { count.value = 1; }); }");
    expect(one).toMatchObject({ code: "assign-shared", severity: "error" });
    expect(one!.message).toContain("`count.value`");
    expect(one!.message).toContain("<Publish");
  });

  test("reads in handlers, bindings and watchers compile cleanly", () => {
    expect(
      diagnostics(`function C() {
  const n = client.state<Integer>(0);
  client.watch(count, () => { n.value = count.value + 1; });
  return client.bind(() => count.value * 2);
}`),
    ).toEqual([]);
  });

  test("the key must be a valid string literal", () => {
    const keyed = (key: string) =>
      diagnostics(
        "",
        `import { client } from "maniatsx/client";\nconst k = "a";\nexport const s = client.shared<boolean>(${key}, false);\n`,
      );
    expect(keyed("k")[0]).toMatchObject({ code: "shared-key" });
    expect(keyed('"x_V"')[0]).toMatchObject({ code: "shared-key" });
    expect(keyed('"9x"')[0]).toMatchObject({ code: "shared-key" });
    expect(keyed('"ok"')).toEqual([]);
  });
});
