import { describe, expect, test } from "bun:test";
import { createContext, useContext } from "../src/context.ts";
import { raw } from "../src/raw.ts";
import { render, renderChildren, useRenderScope } from "../src/render.ts";
import { jsx } from "../src/jsx-runtime.ts";
import { Fragment, MS_CODE, type MsCode, type Node } from "../src/vnode.ts";

const ms = (code: string): MsCode => ({ $$typeof: MS_CODE, code });
const warnings = () => {
  const list: string[] = [];
  return { list, onWarning: (m: string) => void list.push(m) };
};

describe("elements and attributes", () => {
  test("self-closes empty elements", () => {
    expect(render(<quad size={[10, 5]} />)).toBe('<quad size="10 5" />');
    expect(render(<frame />)).toBe("<frame />");
  });

  test("renders an included page", () => {
    expect(render(<include url="./page.xml?a=1&b=2" />)).toBe(
      '<include url="./page.xml?a=1&amp;b=2" />',
    );
  });

  test("compact nesting has no whitespace", () => {
    expect(
      render(
        <frame>
          <quad />
          <label text="hi" />
        </frame>,
      ),
    ).toBe('<frame><quad /><label text="hi" /></frame>');
  });

  test("attributes keep prop order; key and children never appear", () => {
    const xml = render(
      jsx("frame", { "z-index": 2, id: "b", children: jsx("quad", {}, "q") }, "k"),
    );
    expect(xml).toBe('<frame z-index="2" id="b"><quad /></frame>');
  });

  test("serialises numbers, booleans, tuples, classes and omits nullish", () => {
    const xml = render(
      <quad
        pos={[0.1 + 0.2, -0]}
        size={[1e21, 1e-7]}
        hidden={true}
        data-on={false}
        class={["a", "b"]}
        id={undefined}
        bgcolor={null as any}
      />,
    );
    expect(xml).toBe(
      '<quad pos="0.3 0" size="1000000000000000000000 0" hidden="1" data-on="0" class="a b" />',
    );
  });

  test("escapes attribute values", () => {
    expect(render(<label text={`a&b<c>"d"'e'\nf`} />)).toBe(
      '<label text="a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;&#10;f" />',
    );
  });

  test("throws on object attribute values naming element and attribute", () => {
    expect(() => render(jsx("quad", { size: { w: 1 } }))).toThrow(/<quad> attribute "size"/);
    expect(() => render(jsx("label", { text: () => "x" }))).toThrow(/<label> attribute "text"/);
  });

  test("throws on non-finite numbers", () => {
    expect(() => render(jsx("quad", { pos: [NaN, 0] }))).toThrow(/<quad> attribute "pos"/);
  });

  test("rejects unsafe attribute and element names", () => {
    expect(() => render(jsx("quad", { 'a"b': "x" }))).toThrow(/attribute name/);
    expect(() => render(jsx("a b", {}))).toThrow(/element name/);
  });

  test("warns on empty tuples and omits them", () => {
    const w = warnings();
    expect(render(<quad pos={[] as any} />, w)).toBe("<quad />");
    expect(w.list[0]).toMatch(/"pos"/);
  });
});

describe("children", () => {
  test("fragments and arrays flatten; nullish and booleans render nothing", () => {
    const items = [1, 2].map((i) => jsx("quad", { id: `q${i}` }, i));
    const xml = render(
      <frame>
        <>
          {items}
          {null}
          {undefined}
          {false}
          {true}
        </>
      </frame>,
    );
    expect(xml).toBe('<frame><quad id="q1" /><quad id="q2" /></frame>');
    expect(render([null, [<quad />, [<quad />]]] as Node)).toBe("<quad /><quad />");
    expect(render(jsx(Fragment, {}))).toBe("");
  });

  test("function components get props including children", () => {
    function Box(props: { title: string; children?: Node }) {
      return (
        <frame id={props.title}>
          <label text={props.title} />
          {props.children}
        </frame>
      );
    }
    expect(
      render(
        <Box title="t">
          <quad />
        </Box>,
      ),
    ).toBe('<frame id="t"><label text="t" /><quad /></frame>');
  });

  test("text children are rejected, naming the parent", () => {
    expect(() => render(jsx("frame", { children: "hello" }))).toThrow(/<frame>/);
    expect(() => render(jsx("frame", { children: [jsx("quad", {}), 5] }))).toThrow(/<frame>/);
    expect(() => render("loose")).toThrow(/top level/);
  });

  test("text through a component is still attributed to the enclosing element", () => {
    const Text = () => "oops";
    expect(() =>
      render(
        <frame>
          <Text />
        </frame>,
      ),
    ).toThrow(/<frame>/);
  });

  test("timeout takes a non-negative integer as text", () => {
    expect(render(<timeout>{30000}</timeout>)).toBe("<timeout>30000</timeout>");
    expect(() => render(<timeout>{-1}</timeout>)).toThrow(/<timeout>/);
    expect(() => render(<timeout>{1.5}</timeout>)).toThrow(/<timeout>/);
    expect(() => render(jsx("timeout", { children: "5" }))).toThrow(/<timeout>/);
  });

  test("label text and textprefix accept numbers", () => {
    expect(render(<label text={42} textprefix={1.5} />)).toBe(
      '<label text="42" textprefix="1.5" />',
    );
  });

  test("style and stylesheet allow escaped text", () => {
    expect(render(jsx("style", { children: "a<b&c" }))).toBe("<style>a&lt;b&amp;c</style>");
  });

  test("ManiaScript code outside script throws", () => {
    expect(() => render(jsx("frame", { children: ms("x") }))).toThrow(/script/);
  });

  test("raw XML is inserted verbatim", () => {
    expect(render(<frame>{raw('<legacy a="1"/>')}</frame>)).toBe('<frame><legacy a="1"/></frame>');
  });

  test("an empty raw child still self-closes the parent", () => {
    expect(render(<frame>{raw("")}</frame>)).toBe("<frame />");
  });
});

describe("script", () => {
  test("wraps text in an XML comment", () => {
    expect(render(jsx("script", { children: "main() {}" }))).toBe(
      "<script><!--\nmain() {}\n--></script>",
    );
  });

  test("accepts MsCode and arrays of parts", () => {
    expect(render(jsx("script", { children: [ms("a;"), "\n", ms("b;")] }))).toBe(
      "<script><!--\na;\nb;\n--></script>",
    );
  });

  test("keeps script text unescaped and keeps attributes", () => {
    expect(render(jsx("script", { id: "s", children: "if (a < b && c) {}" }))).toBe(
      '<script id="s"><!--\nif (a < b && c) {}\n--></script>',
    );
  });

  test("rejects -- anywhere in content", () => {
    expect(() => render(jsx("script", { children: "a --> b" }))).toThrow(/"--"/);
    expect(() => render(jsx("script", { children: ms("x-->y") }))).toThrow(/"--"/);
    expect(() => render(jsx("script", { children: "ok;\n// ---- section" }))).toThrow(/line 2/);
  });

  test("rejects elements inside script", () => {
    expect(() => render(jsx("script", { children: jsx("quad", {}) }))).toThrow(/script/);
  });

  test("empty script self-closes", () => {
    expect(render(jsx("script", {}))).toBe("<script />");
  });
});

describe("pretty output", () => {
  test("indents two spaces, one element per line", () => {
    const xml = render(
      <frame id="a">
        <frame>
          <quad />
        </frame>
        <label text="x" />
      </frame>,
      { pretty: true },
    );
    expect(xml).toBe(
      [
        '<frame id="a">',
        "  <frame>",
        "    <quad />",
        "  </frame>",
        '  <label text="x" />',
        "</frame>",
      ].join("\n"),
    );
  });

  test("script and style text are indented on their own line", () => {
    const xml = render(<frame>{jsx("script", { children: "x;" })}</frame>, { pretty: true });
    expect(xml).toBe("<frame>\n  <script><!--\nx;\n--></script>\n</frame>");
  });

  test("compact is the default", () => {
    expect(
      render(
        <frame>
          <quad />
        </frame>,
      ),
    ).not.toContain("\n");
  });
});

describe("warnings", () => {
  test("duplicate ids within one render", () => {
    const w = warnings();
    render(
      <frame id="a">
        <quad id="b" />
        <quad id="a" />
      </frame>,
      w,
    );
    expect(w.list).toHaveLength(1);
    expect(w.list[0]).toContain('"a"');
  });

  test("unique ids do not warn", () => {
    const w = warnings();
    render(
      <frame id="a">
        <quad id="b" />
      </frame>,
      w,
    );
    expect(w.list).toEqual([]);
  });

  test("warnBytes warns only when exceeded", () => {
    const w = warnings();
    render(<quad />, { ...w, warnBytes: 100 });
    expect(w.list).toEqual([]);
    render(<label text={"x".repeat(50)} />, { ...w, warnBytes: 20 });
    expect(w.list).toHaveLength(1);
    expect(w.list[0]).toMatch(/warnBytes/);
  });

  test("warnBytes counts bytes, not characters", () => {
    const w = warnings();
    render(<label text={"é".repeat(10)} />, { ...w, warnBytes: 30 });
    expect(w.list).toHaveLength(1);
  });

  test("default onWarning is console.warn", () => {
    const orig = console.warn;
    const seen: string[] = [];
    console.warn = (m: string) => void seen.push(m);
    try {
      render(
        <frame>
          <quad id="a" />
          <quad id="a" />
        </frame>,
      );
    } finally {
      console.warn = orig;
    }
    expect(seen).toHaveLength(1);
  });
});

// Mimics M3: a collecting root plus parts that register into the nearest one.
describe("scope hooks", () => {
  const COLLECTOR = Symbol("collector");
  type Collector = string[];

  function Root(props: { children?: Node }) {
    const parts: Collector = [];
    return (
      <frame>
        <Appender parts={parts}>{props.children}</Appender>
      </frame>
    );
  }
  function Appender(props: { parts: Collector; children?: Node }) {
    const xml = renderChildren(props.children, { key: COLLECTOR, value: props.parts });
    return [raw(xml), <label text={props.parts.join(",")} />];
  }
  function Part(props: { name: string }) {
    const parts = useRenderScope<Collector>(COLLECTOR);
    if (!parts) throw new Error("no root");
    parts.push(props.name);
    return null;
  }

  test("children render first, then extra output is appended", () => {
    const xml = render(
      <Root>
        <Part name="a" />
        <quad />
        <Part name="b" />
      </Root>,
    );
    expect(xml).toBe('<frame><quad /><label text="a,b" /></frame>');
  });

  test("nearest scope wins and scopes do not leak", () => {
    const xml = render(
      <Root>
        <Part name="outer" />
        <Root>
          <Part name="inner" />
        </Root>
      </Root>,
    );
    expect(xml).toBe('<frame><frame><label text="inner" /></frame><label text="outer" /></frame>');
    expect(useRenderScopeOutside).toThrow(/render/);
  });

  test("useRenderScope returns undefined when no scope matches", () => {
    let seen: unknown = "unset";
    const Probe = () => {
      seen = useRenderScope(COLLECTOR);
      return null;
    };
    render(<Probe />);
    expect(seen).toBeUndefined();
  });

  test("pretty output indents collected children at their depth", () => {
    const xml = render(
      <Root>
        <quad />
      </Root>,
      { pretty: true },
    );
    expect(xml).toBe('<frame>\n  <quad />\n  <label text="" />\n</frame>');
  });

  test("duplicate-id checks are per scope", () => {
    const w = warnings();
    render(
      <>
        <Root>
          <quad id="x" />
        </Root>
        <Root>
          <quad id="x" />
        </Root>
      </>,
      w,
    );
    expect(w.list).toEqual([]);
    render(
      <Root>
        <quad id="x" />
        <quad id="x" />
      </Root>,
      w,
    );
    expect(w.list).toHaveLength(1);
  });

  test("renderChildren sees providers and works outside a scope", () => {
    const C = createContext("d");
    function Echo() {
      return raw(renderChildren(<label text={useContext(C)} />));
    }
    expect(
      render(
        <C.Provider value="p">
          <Echo />
        </C.Provider>,
      ),
    ).toBe('<label text="p" />');
    expect(() => renderChildren(null)).toThrow(/render/);
  });

  test("renderChildren restores state after a throw", () => {
    const C = createContext("d");
    function Recover() {
      let inner = "";
      try {
        renderChildren(
          <C.Provider value="x">
            <frame>{"bad text"}</frame>
          </C.Provider>,
        );
      } catch {
        inner = "caught";
      }
      return <label text={`${inner}:${useContext(C)}`} />;
    }
    expect(
      render(
        <frame>
          <Recover />
        </frame>,
      ),
    ).toBe('<frame><label text="caught:d" /></frame>');
  });
});

function useRenderScopeOutside() {
  useRenderScope(Symbol("x"));
}
