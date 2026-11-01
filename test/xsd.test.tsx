import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { validateXML } from "xmllint-wasm";
import { Manialink, Script, ms, raw, render, type Node } from "../src/index.ts";

const root = new URL("../", import.meta.url);
const text = (url: URL) => readFileSync(url, "utf8");

const vendored = text(new URL("vendor/manialink_v3.xsd", root));

// Test-only relaxations for known gaps in the third-party schema (vendor/ stays untouched).
// Each entry edits the in-memory copy; `gap` is a document that must fail without it.
const RELAXATIONS: Array<{ name: string; apply: (xsd: string) => string; gap: string }> = [
  {
    name: "label linespacing is a real, the XSD types it as bool",
    apply: (xsd) =>
      xsd.replace(
        '<xs:attribute name="linespacing" type="type_bool" use="optional">',
        '<xs:attribute name="linespacing" type="type_floatPositive" use="optional">',
      ),
    gap: '<manialink version="3"><label linespacing="1.2" /></manialink>',
  },
  {
    name: "textedit has a name attribute used by production templates",
    apply: (xsd) => {
      const start = xsd.indexOf('<xs:element name="textedit"');
      const marker = '<xs:attributeGroup ref="scriptAttrib" />';
      const at = xsd.indexOf(marker, start);
      if (start < 0 || at < 0) return xsd;
      const name = '<xs:attribute name="name" type="xs:string" use="optional" />';
      return xsd.slice(0, at) + marker + name + xsd.slice(at + marker.length);
    },
    gap: '<manialink version="3"><textedit name="ed" /></manialink>',
  },
  {
    name: "minimap is declared but never allowed as a child of any container",
    apply: (xsd) =>
      xsd.replaceAll(
        '<xs:element ref="timeline" minOccurs="0" maxOccurs="unbounded" />',
        '<xs:element ref="timeline" minOccurs="0" maxOccurs="unbounded" />' +
          '<xs:element ref="minimap" minOccurs="0" maxOccurs="unbounded" />',
      ),
    gap: '<manialink version="3"><minimap /></manialink>',
  },
  {
    name: "manialink has a layer attribute (e.g. ScoresTable) that the XSD lacks",
    apply: (xsd) =>
      xsd.replace(
        '<xs:attribute name="background" type="type_bool" use="optional">',
        '<xs:attribute name="layer" type="xs:string" use="optional" />' +
          '<xs:attribute name="background" type="type_bool" use="optional">',
      ),
    gap: '<manialink version="3" layer="ScoresTable" />',
  },
];

const relaxed = RELAXATIONS.reduce((xsd, r) => r.apply(xsd), vendored);

async function validate(fileName: string, xml: string, schema = relaxed) {
  const result = await validateXML({
    xml: [{ fileName, contents: xml }],
    schema: [{ fileName: "manialink_v3.xsd", contents: schema }],
  });
  return result.errors.map((e) => e.rawMessage);
}

describe("test-only schema relaxations", () => {
  for (const r of RELAXATIONS) {
    test(r.name, async () => {
      expect(r.apply(vendored)).not.toBe(vendored);
      expect((await validate("gap.xml", r.gap, vendored)).length).toBeGreaterThan(0);
      expect(await validate("gap.xml", r.gap)).toEqual([]);
    });
  }
});

const page = (children: Node) => render(<Manialink id="t">{children}</Manialink>);

describe("golden files validate against the vendored XSD", () => {
  const goldenDir = new URL("test/golden/", root);
  for (const file of readdirSync(goldenDir).filter((f) => f.endsWith(".xml"))) {
    test(file, async () => {
      expect(await validate(file, text(new URL(file, goldenDir)))).toEqual([]);
    });
  }
});

describe("focused renders validate", () => {
  test("the validator rejects invalid input (negative control)", async () => {
    const bad = '<manialink version="3"><quad valign="middle" /></manialink>';
    expect((await validate("bad.xml", bad)).length).toBeGreaterThan(0);
    const unknown = '<manialink version="3"><nothing /></manialink>';
    expect((await validate("unknown.xml", unknown)).length).toBeGreaterThan(0);
  });

  const cases: Record<string, Node> = {
    frame: (
      <frame id="f" pos={[-10, 5.5]} size={[20, 10]} z-index={3} scale={1.5} rot={45} hidden clip>
        <quad />
      </frame>
    ),
    quad: (
      <quad
        pos={[1, -2]}
        size={[10, 10]}
        bgcolor="111111cc"
        image="https://example.com/a.png"
        keepratio="Fit"
        blend="add"
        halign="center"
        valign="center2"
        opacity={0.5}
        action="act"
        scriptevents
        class={["a", "b"]}
      />
    ),
    label: (
      <label
        text={12.5}
        textprefix="Time: "
        textsize={2}
        textcolor="fff"
        textfont="GameFontSemiBold"
        halign="right"
        valign="center"
        autonewline
        maxline={3}
        linespacing={1.2}
      />
    ),
    entry: (
      <entry
        id="e"
        name="field"
        default="x"
        maxlen={10}
        textformat="Password"
        valuetype="Ml_Natural"
        textsize={2}
      />
    ),
    textedit: <textedit id="te" name="ed" textformat="Script" showlinenumbers autonewline />,
    gauge: <gauge ratio={0.5} color="f00" drawbg />,
    slider: <slider value={0.5} minrange={0} maxrange={1} />,
    video: <video data="https://example.com/v.webm" play volume={0.5} />,
    audio: <audio data="https://example.com/a.ogg" play volume={0.5} />,
    camera: <camera pos={[0, 0]} size={[10, 10]} />,
    colorpicker: <colorpicker id="cp" />,
    minimap: <minimap pos={[0, 0]} size={[10, 10]} />,
    timeline: <timeline size={[10, 10]} trackcount={2} />,
    graph: (
      <graph size={[10, 10]} min={[0, 0]} max={[10, 10]}>
        <curve color="f00" width={0.5}>
          <point coords={[1, 2]} />
        </curve>
      </graph>
    ),
    fileentry: <fileentry id="fe" type="image" />,
    framemodel: (
      <>
        <framemodel id="model">
          <quad size={[5, 5]} />
        </framemodel>
        <frameinstance modelid="model" pos={[1, 1]} />
      </>
    ),
    stylesheet: (
      <stylesheet>
        <style class="a" textcolor="fff" textfont="GameFontRegular" />
      </stylesheet>
    ),
    dico: (
      <dico>
        <language id="en">{raw("<title>Hello</title>")}</language>
      </dico>
    ),
    timeout: <timeout>{30000}</timeout>,
  };

  for (const [name, children] of Object.entries(cases)) {
    test(name, async () => {
      expect(await validate(`${name}.xml`, page(children))).toEqual([]);
    });
  }

  test("script parts", async () => {
    const xml = render(
      <Manialink id="s" name="TMCP:s" layer="ScoresTable">
        <Script.Include lib="MathLib" as="ML" />
        <Script.Globals>{"declare Integer G;"}</Script.Globals>
        <Script.Functions>{ms`Void f() {}`}</Script.Functions>
        <Script.Main>{"f();"}</Script.Main>
        <Script.Events>{"continue;"}</Script.Events>
        <Script.Loop>{"f();"}</Script.Loop>
      </Manialink>,
      { pretty: true },
    );
    expect(await validate("script.xml", xml)).toEqual([]);
  });
});
