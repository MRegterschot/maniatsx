import { describe, expect, test } from "bun:test";
import { Dico, Manialink, render } from "../src/index.ts";

const translations = {
  fr: { greeting: "Salut", other: "A & B < C > D" },
  en: { greeting: "Hello" },
};

describe("Dico", () => {
  test("renders languages and escaped entries in order", () => {
    expect(render(<Dico translations={translations} />)).toBe(
      '<dico><language id="fr"><greeting>Salut</greeting><other>A &amp; B &lt; C &gt; D</other></language><language id="en"><greeting>Hello</greeting></language></dico>',
    );
  });

  test("indents entries in pretty output", () => {
    expect(render(<Dico translations={translations} />, { pretty: true })).toBe(
      '<dico>\n  <language id="fr">\n    <greeting>Salut</greeting>\n    <other>A &amp; B &lt; C &gt; D</other>\n  </language>\n  <language id="en">\n    <greeting>Hello</greeting>\n  </language>\n</dico>',
    );
  });

  test("rejects invalid textids and names the language and id", () => {
    expect(() => render(<Dico translations={{ fr: { "bad id": "x" } }} />)).toThrow(/fr.*bad id/);
  });

  test("rejects empty translations", () => {
    expect(() => render(<Dico translations={{}} />)).toThrow(/language/);
  });

  test("works inside a Manialink", () => {
    expect(
      render(
        <Manialink id="page" prolog={false}>
          <Dico translations={{ en: { greeting: "Hello" } }} />
          <label textid="greeting" />
        </Manialink>,
      ),
    ).toBe(
      '<manialink id="page" version="3"><dico><language id="en"><greeting>Hello</greeting></language></dico><label textid="greeting" /></manialink>',
    );
  });
});
