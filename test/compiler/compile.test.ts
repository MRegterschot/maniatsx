import { expect, test } from "bun:test";
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
    includes: [],
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
