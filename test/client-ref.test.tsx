import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { Manialink, render } from "../src/index.ts";
import { client } from "../src/client/index.ts";
import type { CMlLabel } from "../src/maniascript/index.ts";
import { compileSource } from "../src/compiler/index.ts";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

const dir = "test/compiler/.tmp";
const file = "test/ref-fixture.tsx";
let counter = 0;

// Compiles a virtual fixture, writes it next to the other e2e outputs and imports it
async function load(source: string): Promise<Record<string, any>> {
  const result = compileSource(file, source);
  expect(result.diagnostics).toEqual([]);
  await mkdir(dir, { recursive: true });
  const name = `ref-${++counter}`;
  await Bun.write(`${dir}/${name}.tsx`, result.code);
  return import(`./compiler/.tmp/${name}.tsx`);
}
afterAll(async () => {
  for (let i = 1; i <= counter; i++) await rm(`${dir}/ref-${i}.tsx`, { force: true });
});

const head = `import { client, type Integer, type ClientState, type ClientHandler, type ClientBinding, type ClientRef } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";
`;

function script(node: Parameters<typeof render>[0]): { xml: string; script: string } {
  const xml = render(<Manialink id="refs">{node}</Manialink>);
  const scripts = extractScripts(xml);
  expect(scripts).toHaveLength(1);
  expect(parseManiaScript(scripts[0]!).errors).toEqual([]);
  return { xml, script: scripts[0]! };
}

describe("client.ref", () => {
  test("ref global, init order and control lowering", async () => {
    const m = await load(`${head}
export function Widget() {
  const count = client.state<Integer>(1);
  const title = client.ref<CMlLabel>();
  client.onInit(() => { title.control.Value = "ready"; });
  return (
    <frame>
      <label ref={title} text={client.bind(() => "n=" + count.value)} />
      <quad id="btn" onClick={client.handler(() => { count.value += 1; title.control.Opacity = 0.5; })} />
    </frame>
  );
}`);
    const out = script(<m.Widget />);
    const s = out.script;
    expect(s).toContain("declare CMlLabel Mtx_R1;");
    expect(out.xml).toContain('id="mtx-1"');
    expect(s).toContain('Mtx_R1 <=> (Page.MainFrame.GetFirstChild("mtx-1") as CMlLabel);');
    expect(s).toContain('Mtx_R1.Value = "ready";');
    expect(s).toContain("Mtx_R1.Opacity = 0.5;");
    // The ref lookup is the very first statement of main, ahead of state and onInit
    const main = s.slice(s.indexOf("main() {"));
    expect(main.indexOf("Mtx_R1 <=>")).toBeLessThan(main.indexOf("Mtx_S1 = 1;"));
    expect(main.indexOf("Mtx_S1 = 1;")).toBeLessThan(main.indexOf('Mtx_R1.Value = "ready";'));
    expect(main.indexOf("Mtx_R1 <=>")).toBeLessThan(main.indexOf("Mtx_C1 <=>"));
  });

  test("an explicit element id is kept", async () => {
    const m = await load(`${head}
export function Widget() {
  const title = client.ref<CMlLabel>();
  client.onInit(() => { title.control.Value = "x"; });
  return <label id="name" ref={title} />;
}`);
    const out = script(<m.Widget />);
    expect(out.xml).toContain('id="name"');
    expect(out.script).toContain('GetFirstChild("name") as CMlLabel');
  });

  test("an attached but unused ref emits no script", async () => {
    const m = await load(`${head}
export function Widget() {
  const title = client.ref<CMlLabel>();
  return <label ref={title} />;
}`);
    const xml = render(
      <Manialink id="refs">
        <m.Widget />
      </Manialink>,
    );
    expect(xml).not.toContain("Mtx_R");
    expect(xml).not.toContain("<script");
    expect(xml).not.toContain("ref=");
  });

  test("render errors name the ref's source site", async () => {
    const unattached = await load(`${head}
export function Widget() {
  const title = client.ref<CMlLabel>();
  client.onInit(() => { title.control.Value = "x"; });
  return <label />;
}`);
    expect(() =>
      render(
        <Manialink id="refs">
          <unattached.Widget />
        </Manialink>,
      ),
    ).toThrow(/client\.ref declared at test\/ref-fixture\.tsx:5:\d+ .*never attached/);

    const twice = await load(`${head}
export function Widget() {
  const title = client.ref<CMlLabel>();
  return <frame><label id="a" ref={title} /><label id="b" ref={title} /></frame>;
}`);
    expect(() =>
      render(
        <Manialink id="refs">
          <twice.Widget />
        </Manialink>,
      ),
    ).toThrow(
      /test\/ref-fixture\.tsx:5:\d+ is attached to two elements \(<label id="a"> and <label id="b">\)/,
    );
  });

  test("compile errors", () => {
    const missing = compileSource(file, `${head}\nconst r = client.ref();\n`);
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "ref-type",
        line: 4,
        message: expect.stringContaining("client.ref()"),
      }),
    ]);
    const bad = compileSource(file, `${head}\nconst r = client.ref<Integer>();\n`);
    expect(bad.diagnostics.length).toBeGreaterThan(0);
    const handle = compileSource(
      file,
      `${head}\nconst r = client.ref<CMlLabel>();\nclient.onInit(() => { const x = r; });\n`,
    );
    expect(handle.diagnostics).toEqual([
      expect.objectContaining({ code: "handle", message: expect.stringContaining(".control") }),
    ]);
  });
});

// T5: client values created in one component, placed by another
describe("client values across components", () => {
  const source = `${head}
interface ViewProps {
  count: ClientState<Integer>;
  onInc: ClientHandler;
  text: ClientBinding<string>;
  title: ClientRef<CMlLabel>;
}
export function View({ onInc, text, title }: ViewProps) {
  return (
    <frame>
      <label ref={title} text={text} />
      <quad onClick={onInc} />
    </frame>
  );
}
export function AltView({ onInc, text, title }: ViewProps) {
  return (
    <frame pos={[5, 5]}>
      <frame size={[40, 10]}>
        <label ref={title} text={text} textsize={3} />
      </frame>
      <quad size={[8, 8]} onClick={onInc} />
    </frame>
  );
}
// The skin may also use props.ref directly in its own client code
export function ViewWithInit(props: ViewProps) {
  client.onInit(() => { props.title.control.Opacity = 1.0; });
  return <View {...props} />;
}
export function Logic({ view: V }: { view: (props: ViewProps) => any }) {
  const count = client.state<Integer>(3);
  const title = client.ref<CMlLabel>();
  client.onInit(() => { title.control.Value = "ready"; });
  return (
    <V
      count={count}
      title={title}
      text={client.bind(() => "n=" + count.value)}
      onInc={client.handler(() => { count.value += 1; title.control.Opacity = 0.5; })}
    />
  );
}`;

  test("two views produce identical wiring", async () => {
    const m = await load(source);
    const a = script(<m.Logic view={m.View} />);
    const b = script(<m.Logic view={m.AltView} />);
    expect(a.xml).not.toBe(b.xml);
    expect(b.xml).toContain('textsize="3"');
    expect(b.script).toBe(a.script);
    expect(a.script).toContain("declare CMlLabel Mtx_R1;");
    expect(a.script).toContain('Mtx_R1 <=> (Page.MainFrame.GetFirstChild("mtx-1") as CMlLabel);');
    expect(a.script).toContain("Mtx_S1 += 1;");
    expect(a.script).toContain("Mtx_R1.Opacity = 0.5;");
    expect(a.script).toContain('Mtx_C1.Value = "n=" ^ Mtx_S1;');
  });

  test("a view's own client code can use a ref prop", async () => {
    const m = await load(source);
    const out = script(<m.Logic view={m.ViewWithInit} />);
    expect(out.script).toContain("Mtx_R1.Opacity = 1.;");
    expect(out.script.match(/Mtx_R1 <=>/g)).toHaveLength(1);
    expect(out.script).not.toContain("#Struct");
  });

  test("a view that never places the ref fails at render", async () => {
    const m = await load(`${source}
export function Broken({ onInc, text }: ViewProps) {
  return <frame><label text={text} /><quad onClick={onInc} /></frame>;
}`);
    expect(() =>
      render(
        <Manialink id="refs">
          <m.Logic view={m.Broken} />
        </Manialink>,
      ),
    ).toThrow(/never attached/);
  });
});

// Type-level checks; never called, so the uncompiled client.ref does not throw
function typeChecks() {
  const label = client.ref<CMlLabel>();
  void (<label ref={label} />);
  void (<frame ref={label} />);
  const control: CMlLabel = label.control;
  // @ts-expect-error ref takes a client.ref handle
  void (<label ref="x" />);
  // @ts-expect-error control is read-only
  label.control = control;
}
void typeChecks;
