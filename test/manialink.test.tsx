import { describe, expect, test } from "bun:test";
import { createContext, useContext } from "../src/context.ts";
import { Manialink, Script } from "../src/manialink.tsx";
import { ms } from "../src/ms.ts";
import { render } from "../src/render.ts";

const PROLOG = '<?xml version="1.0" encoding="utf-8" standalone="yes"?>';
const scriptOf = (xml: string) => /<script><!--\n([\s\S]*)\n--><\/script>/.exec(xml)?.[1];

describe("manialink element", () => {
  test("prolog is on by default and can be disabled", () => {
    expect(render(<Manialink id="a" />)).toBe(`${PROLOG}<manialink id="a" version="3" />`);
    expect(render(<Manialink id="a" prolog={false} />)).toBe('<manialink id="a" version="3" />');
  });

  test("attribute order, name, layer and children", () => {
    const xml = render(
      <Manialink id="a" name="TMCP:a" layer="ScoresTable" prolog={false}>
        <quad />
      </Manialink>,
    );
    expect(xml).toBe(
      '<manialink id="a" name="TMCP:a" version="3" layer="ScoresTable"><quad /></manialink>',
    );
  });

  test("no script without parts", () => {
    expect(render(<Manialink id="a" prolog={false} />)).not.toContain("<script");
  });

  test("nested Manialink throws", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <frame>
            <Manialink id="b" />
          </frame>
        </Manialink>,
      ),
    ).toThrow(/nested/);
  });

  test("a missing id throws", () => {
    expect(() => render(<Manialink {...({} as { id: string })} />)).toThrow(/id/);
  });

  test("context flows through Manialink", () => {
    const Theme = createContext("default");
    const Probe = () => <label text={useContext(Theme)} />;
    const xml = render(
      <Theme.Provider value="dark">
        <Manialink id="a" prolog={false}>
          <Probe />
        </Manialink>
      </Theme.Provider>,
    );
    expect(xml).toBe('<manialink id="a" version="3"><label text="dark" /></manialink>');
  });

  test("contexts provided inside Manialink reach script-registering components", () => {
    const Name = createContext("none");
    const Fn = () => (
      <Script.Functions>{ms`Text N() { return ${useContext(Name)}; }`}</Script.Functions>
    );
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Name.Provider value="x">
          <Fn />
        </Name.Provider>
      </Manialink>,
    );
    expect(scriptOf(xml)).toStartWith('Text N() { return "x"; }');
  });
});

describe("script assembly", () => {
  test("pretty output snapshot", () => {
    const xml = render(
      <Manialink id="win" name="TMCP:win" prolog={false}>
        <frame>
          <quad />
          <Script.Include lib="TextLib" as="TL" />
          <Script.Globals>{ms`declare Integer G_Count;`}</Script.Globals>
          <Script.Functions>{ms`
            Void Hide() {
              Page.GetFirstChild(${"win"}).Hide();
            }
          `}</Script.Functions>
          <Script.Main>{ms`G_Count = 0;`}</Script.Main>
          <Script.Events>{ms`
            if (Event.Type == CMlScriptEvent::Type::MouseClick) {
              Hide();
            }
          `}</Script.Events>
          <Script.Loop>{ms`G_Count += 1;`}</Script.Loop>
        </frame>
      </Manialink>,
      { pretty: true },
    );
    expect(xml).toBe(`<manialink id="win" name="TMCP:win" version="3">
  <frame>
    <quad />
  </frame>
  <script><!--
#Include "TextLib" as TL
declare Integer G_Count;
Void Hide() {
  Page.GetFirstChild("win").Hide();
}
main() {
  G_Count = 0;
  while (True) {
    yield;
    foreach (Event in PendingEvents) {
      if (Event.Type == CMlScriptEvent::Type::MouseClick) {
        Hide();
      }
    }
    G_Count += 1;
  }
}
--></script>
</manialink>`);
  });

  test("compact assembly in slot order regardless of registration order", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Loop>{"L();"}</Script.Loop>
        <Script.Events>{"E();"}</Script.Events>
        <Script.Main>{"M();"}</Script.Main>
        <Script.Functions>{"F();"}</Script.Functions>
        <Script.Globals>{"G;"}</Script.Globals>
        <Script.Include lib="MathLib" as="ML" />
      </Manialink>,
    );
    expect(scriptOf(xml)).toBe(
      [
        '#Include "MathLib" as ML',
        "G;",
        "F();",
        "main() {",
        "  M();",
        "  while (True) {",
        "    yield;",
        "    foreach (Event in PendingEvents) {",
        "      E();",
        "    }",
        "    L();",
        "  }",
        "}",
      ].join("\n"),
    );
  });

  test("parts keep tree order across nested components", () => {
    const A = () => (
      <frame>
        <Script.Main>{"a1();"}</Script.Main>
        <B />
        <Script.Main>{"a2();"}</Script.Main>
      </frame>
    );
    const B = () => <Script.Main>{"b();"}</Script.Main>;
    const xml = render(
      <Manialink id="a" prolog={false}>
        <A />
        <Script.Main>{"c();"}</Script.Main>
      </Manialink>,
    );
    expect(scriptOf(xml)).toContain("  a1();\n  b();\n  a2();\n  c();\n");
  });

  test("includes, globals and functions only still emit an empty main loop", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Functions>{"Void F() {}"}</Script.Functions>
      </Manialink>,
    );
    expect(scriptOf(xml)).toBe("Void F() {}\nmain() {\n  while (True) {\n    yield;\n  }\n}");
  });

  test("string and array children are dedented; empty parts are ignored", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Main>
          {[
            `
              if (x) {
                y();
              }
            `,
            ms`z();`,
            null,
            false,
          ]}
        </Script.Main>
        <Script.Loop>{"  "}</Script.Loop>
      </Manialink>,
    );
    expect(scriptOf(xml)).toBe(
      "main() {\n  if (x) {\n    y();\n  }\n  z();\n  while (True) {\n    yield;\n  }\n}",
    );
  });

  test("invalid child types throw", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <Script.Main>{42 as any}</Script.Main>
        </Manialink>,
      ),
    ).toThrow(/Script.Main/);
  });

  test("script content containing -- throws", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <Script.Main>{"x = 1; // -->"}</Script.Main>
        </Manialink>,
      ),
    ).toThrow(/"--"/);
  });
});

describe("dedupe by id", () => {
  const Widget = () => (
    <>
      <quad />
      <Script.Functions id="widget-fn">{ms`Void Widget() {}`}</Script.Functions>
      <Script.Main>{"Widget();"}</Script.Main>
    </>
  );

  test("a component rendered three times contributes its function once", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Widget />
        <Widget />
        <Widget />
      </Manialink>,
    );
    const script = scriptOf(xml)!;
    expect(script.split("Void Widget() {}").length - 1).toBe(1);
    expect(script.split("Widget();").length - 1).toBe(3);
  });

  test("first part with an id wins; the same id in another slot is separate", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Globals id="x">{"first;"}</Script.Globals>
        <Script.Globals id="x">{"second;"}</Script.Globals>
        <Script.Functions id="x">{"other;"}</Script.Functions>
      </Manialink>,
    );
    const script = scriptOf(xml)!;
    expect(script).toContain("first;");
    expect(script).not.toContain("second;");
    expect(script).toContain("other;");
  });

  test("parts without an id are never deduped", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Main>{"x();"}</Script.Main>
        <Script.Main>{"x();"}</Script.Main>
      </Manialink>,
    );
    expect(scriptOf(xml)).toContain("  x();\n  x();\n");
  });

  test("dedupe is per Manialink", () => {
    const xml = render(
      <>
        <Manialink id="a" prolog={false}>
          <Widget />
        </Manialink>
        <Manialink id="b" prolog={false}>
          <Widget />
        </Manialink>
      </>,
    );
    expect(xml.split("Void Widget() {}").length - 1).toBe(2);
  });
});

describe("includes", () => {
  test("same lib and alias dedupe", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <Script.Include lib="TextLib" as="TL" />
        <Script.Include lib="TextLib" as="TL" />
        <Script.Include lib="MathLib" as="ML" />
      </Manialink>,
    );
    expect(scriptOf(xml)).toStartWith('#Include "TextLib" as TL\n#Include "MathLib" as ML\nmain()');
  });

  test("same lib with another alias throws", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <Script.Include lib="TextLib" as="TL" />
          <Script.Include lib="TextLib" as="T2" />
        </Manialink>,
      ),
    ).toThrow(/TextLib.*already included as "TL"/);
  });

  test("same alias for another lib throws", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <Script.Include lib="TextLib" as="TL" />
          <Script.Include lib="MathLib" as="TL" />
        </Manialink>,
      ),
    ).toThrow(/alias "TL".*TextLib/);
  });

  test("the same alias in separate Manialinks is fine", () => {
    expect(() =>
      render(
        <>
          <Manialink id="a">
            <Script.Include lib="TextLib" as="TL" />
          </Manialink>
          <Manialink id="b">
            <Script.Include lib="MathLib" as="TL" />
          </Manialink>
        </>,
      ),
    ).not.toThrow();
  });

  test("invalid lib or alias throws", () => {
    for (const [lib, as] of [
      ['Text"Lib', "TL"],
      ["TextLib", "T L"],
      ["TextLib", "1"],
      ["", "TL"],
    ] as const) {
      expect(() =>
        render(
          <Manialink id="a">
            <Script.Include lib={lib} as={as} />
          </Manialink>,
        ),
      ).toThrow(/Script.Include/);
    }
  });
});

describe("misuse", () => {
  test("parts outside a Manialink throw", () => {
    expect(() => render(<Script.Main>{"x();"}</Script.Main>)).toThrow(
      /Script.Main.*inside <Manialink>/,
    );
    expect(() => render(<Script.Include lib="TextLib" as="TL" />)).toThrow(/inside <Manialink>/);
    expect(() =>
      render(
        <frame>
          <Script.Loop>{"x();"}</Script.Loop>
        </frame>,
      ),
    ).toThrow(/Script.Loop/);
  });

  test("a raw script together with parts throws, in either order", () => {
    expect(() =>
      render(
        <Manialink id="a">
          <script>{"main() {}"}</script>
          <Script.Main>{"x();"}</Script.Main>
        </Manialink>,
      ),
    ).toThrow(/raw <script>/);
    expect(() =>
      render(
        <Manialink id="a">
          <Script.Include lib="TextLib" as="TL" />
          <frame>
            <script>{"main() {}"}</script>
          </frame>
        </Manialink>,
      ),
    ).toThrow(/raw <script>/);
  });

  test("a raw script alone is allowed", () => {
    const xml = render(
      <Manialink id="a" prolog={false}>
        <script>{"main() {}"}</script>
      </Manialink>,
    );
    expect(xml).toBe(
      '<manialink id="a" version="3"><script><!--\nmain() {}\n--></script></manialink>',
    );
  });

  test("a raw script in one Manialink does not affect another", () => {
    expect(() =>
      render(
        <>
          <Manialink id="a">
            <script>{"main() {}"}</script>
          </Manialink>
          <Manialink id="b">
            <Script.Main>{"x();"}</Script.Main>
          </Manialink>
        </>,
      ),
    ).not.toThrow();
  });
});

describe("duplicate id warnings", () => {
  const collect = () => {
    const list: string[] = [];
    return { list, onWarning: (m: string) => void list.push(m) };
  };

  test("two Manialinks in one render may reuse element ids", () => {
    const w = collect();
    render(
      <>
        <Manialink id="a">
          <quad id="close" />
        </Manialink>
        <Manialink id="b">
          <quad id="close" />
        </Manialink>
      </>,
      w,
    );
    expect(w.list).toEqual([]);
  });

  test("duplicates inside one Manialink still warn", () => {
    const w = collect();
    render(
      <Manialink id="a">
        <quad id="close" />
        <frame>
          <quad id="close" />
        </frame>
      </Manialink>,
      w,
    );
    expect(w.list).toEqual(['Duplicate id "close" on <quad>']);
  });
});
