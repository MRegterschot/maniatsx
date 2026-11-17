import { expect, test } from "bun:test";
import { compileSnippets } from "../support/compile.ts";
import { compileSource, debugEmit } from "../../src/compiler/index.ts";
import type { CompiledCode } from "../../src/client/contract.ts";

test("compiles state, typed captures, action and binding", () => {
  const source = `import {client, action, type Integer, type Real} from "maniatsx/client";
const reset = action("reset");
function widget(i: Integer, r: Real) {
 const s = client.state<Integer>(i);
 const a = client.handler(() => { s.value += i; reset.trigger(); });
 const b = client.bind(() => "x" + s.value + r);
 return [a,b];
}`;
  const result = compileSource("test/compiler/example.tsx", source);
  expect(result.diagnostics).toEqual([]);
  expect(result.code).toContain('type: "Integer", get: () => (i)');
  expect(result.code).toContain('type: "Real", get: () => (r)');
  expect(result.code).toContain('kind: "action", get: () => (reset)');
  expect(result.code).toContain("Mtx_Dirty = True;");
  expect(result.code).toContain('__mtx.bind("Text"');
});

test("debugEmit joins holes", () => {
  const code: CompiledCode = {
    code: ["", " ", " ", " ", ""],
    holes: [
      { kind: "value", type: "Integer", get: () => 0 },
      { kind: "state", get: () => undefined as never },
      { kind: "fn", get: () => undefined as never },
      { kind: "action", get: () => undefined as never },
    ],
    structs: [],
    site: "test",
  };
  expect(debugEmit(code, [3])).toBe("3 <state> <fn> <action>");
  expect(debugEmit(code)).toBe("<hole 0> <state> <fn> <action>");
});

test("sites are relative to the root, so output doesn't depend on the machine", () => {
  const source = `import { client, type Integer } from "maniatsx/client";\nexport const s = () => client.state<Integer>(1);\n`;
  const { code } = compileSource(`${process.cwd()}/test/compiler/fixtures/site.tsx`, source);
  expect(code).toContain('"test/compiler/fixtures/site.tsx:2:');
  expect(code).not.toContain(process.cwd());
});

test("keyPrefix namespaces shared and explicit and default persisted keys", () => {
  const source = `import { client, type Integer } from "maniatsx/client";
const shared = client.shared<Integer>("data", 0);
const stable = client.state<Integer>(0, { persist: true, key: "data" });
const automatic = client.state<Integer>(0, { persist: true });`;
  const plain = compileSource("test/compiler/keys.tsx", source);
  const prefixed = compileSource("test/compiler/keys.tsx", source, { keyPrefix: "plugin-a" });
  const other = compileSource("test/compiler/keys.tsx", source, { keyPrefix: "plugin-b" });
  expect(plain.diagnostics).toEqual([]);
  expect(prefixed.diagnostics).toEqual([]);
  expect(plain.code).toContain('__mtx.shared("data"');
  expect(plain.code).toContain('"key":"data"');
  expect(prefixed.code).toContain('__mtx.shared("plugina_data"');
  expect(prefixed.code).toContain('"key":"data","keyPrefix":"plugin-a"');
  expect(prefixed.code).toContain('"keyPrefix":"plugin-a"');
  expect(other.code).toContain('__mtx.shared("pluginb_data"');
  expect(other.code).toContain('"key":"data","keyPrefix":"plugin-b"');
  expect(
    compileSource("x.tsx", source, { keyPrefix: "bad prefix" }).diagnostics[0]?.message,
  ).toContain("keyPrefix must be non-empty");
});

test("numeric contexts, diagnostics, and division warning", () => {
  const compile = (body: string) =>
    compileSource(
      "test/compiler/numbers.tsx",
      `import { client, type Integer, type Real } from "maniatsx/client"; client.handler(() => { ${body} });`,
    );
  const real = compile("const x: Real = 1;");
  expect(real.diagnostics).toEqual([]);
  expect(real.code).toContain("declare Real x = 1.;");
  expect(compile("const x: number = 1;").diagnostics).toMatchObject([
    { code: "bare-number", severity: "error" },
  ]);
  expect(
    compile("const i: Integer = 1; const r: Real = 2; const x = i + r;").diagnostics,
  ).toMatchObject([{ code: "mixed-number", severity: "error" }]);
  expect(compile("const i: Integer = 1; const x: Real = i / i;").diagnostics).toMatchObject([
    { code: "int-division", severity: "warning" },
  ]);
});

test("class references are assigned with <=>, everything else with =", () => {
  const emit = (body: string) => {
    const { snippets, diagnostics } = compileSnippets(
      "test/compiler/refs.tsx",
      `import { client, ml, type Integer } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";
client.onInit(() => { ${body} });`,
    );
    expect(diagnostics).toEqual([]);
    return snippets[0]!.ms;
  };
  const decl = `let label: CMlLabel | null = ml.Page!.GetFirstChild("status") as CMlLabel;`;
  expect(emit(decl)).toContain(
    'declare CMlLabel label <=> (Page.GetFirstChild("status") as CMlLabel);',
  );
  expect(emit(`${decl} label = ml.Page!.GetFirstChild("other") as CMlLabel;`)).toContain(
    'label <=> (Page.GetFirstChild("other") as CMlLabel);',
  );
  expect(emit(`${decl} label = null;`)).toContain("label <=> Null;");
  const prim = emit("let n: Integer = 1; n = 2; const xs: Integer[] = [1];");
  expect(prim).not.toContain("<=>");
  expect(prim).toContain("n = 2;");
});

test("client.state persist options are baked into the runtime call", () => {
  const compile = (args: string) =>
    compileSource(
      "test/compiler/opts.tsx",
      `import {client} from "maniatsx/client";\nexport const s = client.state<boolean>(false${args});`,
    );
  const plain = compile("");
  expect(plain.diagnostics).toEqual([]);
  expect(plain.code).not.toContain("persist");

  const persisted = compile(", { persist: true }");
  expect(persisted.diagnostics).toEqual([]);
  expect(persisted.code).toContain('"test/compiler/opts.tsx:2:18", {"persist":true})');

  const keyed = compile(', { persist: true, key: "open" }');
  expect(keyed.diagnostics).toEqual([]);
  expect(keyed.code).toContain('{"persist":true,"key":"open"}');

  expect(compile(", { persist: false }").code).not.toContain("persist");
  for (const bad of [
    ", opts",
    ", { persist: flag }",
    ", { persist: true, key: name }",
    ', { persist: true, key: "1x" }',
    ', { key: "open" }',
    ", { persist: true, other: 1 }",
  ])
    expect(compile(bad).diagnostics.map((d) => d.code)).toContain("state-options");
});
