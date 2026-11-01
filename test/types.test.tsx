// Type-level tests: checked by `bun run typecheck`; the runtime test only keeps the file discovered.
import { expect, test } from "bun:test";
import { MS_CODE, type MsCode } from "../src/vnode.ts";
import type { JSX } from "../src/jsx-types.ts";

const code: MsCode = { $$typeof: MS_CODE, code: "main() {}" };

// Positive cases

export const frameWithChildren = (
  <frame pos={[-10, 5]} size="20 10" z-index={20} clip hidden={false} id="root">
    <quad size={[5, 5]} bgcolor="111111cc" halign="center" valign="center2" />
    <label text="hi" textfont="GameFontSemiBold" textsize={1.5} linespacing={1.2} />
    {[<quad key="a" />, null, false]}
  </frame>
);

export const posForms = (
  <>
    <quad pos={[1, -2]} size={[3, 4]} />
    <quad pos="1 -2" size="3 4" />
  </>
);

export const includedPage = <include url="./page.xml" key="page" />;

export const customFont = <label textfont="file://Media/Font/Custom.ttf" />;

export const enums = (
  <>
    <quad keepratio="Fit" blend="add" />
    <entry textformat="Password" valuetype="Ml_Natural" name="field" maxlen={10} />
    <textedit textformat="Script" name="editor" showlinenumbers autonewline />
    <fileentry type="image" />
  </>
);

export const dataAttributes = <quad data-foo="bar" data-count={3} />;

export const classes = (
  <>
    <quad class="trigger" />
    <quad class={["a", "b"]} />
  </>
);

export const scripts = (
  <>
    <script>{"declare Integer A;"}</script>
    <script>{code}</script>
    <script>{["a", code]}</script>
  </>
);

export const containers = (
  <manialink id="x" name="X" version={3}>
    <timeout>{0}</timeout>
    <stylesheet>
      <style class="a" textcolor="fff" />
    </stylesheet>
    <dico>
      <language id="en" />
    </dico>
    <framemodel id="model">
      <quad />
    </framemodel>
    <frameinstance modelid="model" />
    <graph size={[10, 10]} min={[0, 0]} max="10 10">
      <curve color="f00" width={1}>
        <point coords={[1, 1]} />
      </curve>
    </graph>
  </manialink>
);

// Components are valid JSX elements next to intrinsics
function Box(props: { w: number }) {
  return <quad size={[props.w, 1]} />;
}
export const component = <Box w={3} key="k" />;

// key is accepted on intrinsic elements (string and number)
export const keyed = (
  <frame key="f">
    <quad key="q" />
    <label key={2} text="x" />
    <script key="s">{code}</script>
  </frame>
);

// Resolved element types
export const labelProps: JSX.IntrinsicElements["label"] = { linespacing: 1.5 };
export const everyElementKey: keyof JSX.IntrinsicElements = "colorpicker";

// Negative cases

// @ts-expect-error unknown attribute
export const unknownAttr = <quad nope="1" />;

// @ts-expect-error wrong enum literal
export const badEnum = <label valign="middle" />;

// @ts-expect-error string for a boolean attribute
export const badBool = <frame hidden="1" />;

// @ts-expect-error boolean for a string attribute
export const badString = <label text={true} />;

export const numericLabel = <label text={42} textprefix={1.5} />;

// @ts-expect-error legacy v2 attribute
export const legacyPos = <quad posn="0 0 0" />;

// @ts-expect-error unknown element
export const unknownElement = <nothing />;

// @ts-expect-error quad is a leaf and takes no children
export const quadChildren = <quad>{<quad />}</quad>;

// @ts-expect-error label is a leaf and takes no children
export const labelChildren = <label>text</label>;

// @ts-expect-error element children are not allowed inside script
export const scriptElement = <script>{<quad />}</script>;

// @ts-expect-error include requires a url
export const includeNoUrl = <include />;

// @ts-expect-error include cannot have children
export const includeChildren = <include url="./page.xml" children={<quad />} />;

// @ts-expect-error language needs an id
export const languageNoId = <language />;

// @ts-expect-error pos tuple needs two numbers
export const badTuple = <quad pos={[1, 2, 3]} />;

test("type tests are checked by tsc", () => {
  expect(true).toBe(true);
});
