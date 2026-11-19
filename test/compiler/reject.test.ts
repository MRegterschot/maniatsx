import { expect, test, spyOn } from "bun:test";
import { compileSource } from "../../src/compiler/index.ts";
import { Analyzer } from "../../src/compiler/analyzer.ts";

const prefix = `import { client, type Integer, type Text, type Ident } from "maniatsx/client";
`;

function rejects(source: string, marker: string, message: RegExp) {
  const offset = source.indexOf(marker);
  expect(offset).toBeGreaterThanOrEqual(0);
  const before = source.slice(0, offset).split("\n");
  const result = compileSource("test/compiler/rejections.tsx", source);
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        severity: "error",
        line: before.length,
        column: before[before.length - 1]!.length + 1,
        message: expect.stringMatching(message),
      }),
    ]),
  );
}

const cases: [string, string, string, RegExp][] = [
  ["class", "class Example {}", "class Example", /classes/i],
  ["this", "const x = this;", "this", /this/i],
  ["closure", "const x = () => 1;", "() => 1", /closure/i],
  ["await", "const x = await value;", "await value", /await/i],
  ["try/catch", "try {} catch {}", "try", /try\/catch/i],
  ["throw", "throw 'x';", "throw", /throw/i],
  ["spread", "const a: Integer[] = []; const b = [...a];", "...a", /spread/i],
  ["destructuring", "const { a } = obj;", "{ a }", /destructuring/i],
  ["optional chaining", "const x = a?.b;", "a?.b", /optional chaining/i],
  ["nullish coalescing", "const x = a ?? b;", "a ?? b", /\?\?/],
  ["regex", "const x = /abc/;", "/abc/", /regular expression/i],
  ["Date", "const x = new Date();", "new Date()", /Date/i],
  ["JSON", "const x = JSON.stringify('x');", "JSON.stringify", /JSON/i],
  ["delete", "delete a.b;", "delete a.b", /delete/i],
  ["typeof", "const x = typeof a;", "typeof a", /typeof/i],
  ["instanceof", "const x = a instanceof Date;", "a instanceof Date", /instanceof/i],
  ["Math without a MathLib equivalent", "const x = Math.cbrt(2);", "Math.cbrt(2)", /Math\.cbrt/],
  [
    "unsupported array method",
    "const a: Integer[] = []; const b = a.map(1);",
    "a.map(1)",
    /array method `\.map`/i,
  ],
  [
    "splice with a count other than 1",
    "const a: Integer[] = []; a.splice(0, 2);",
    "a.splice(0, 2)",
    /array method `\.splice`/i,
  ],
  [
    "indexOf on an array of arrays",
    "const a: Integer[][] = []; const b: Integer[] = []; const x = a.indexOf(b);",
    "a.indexOf(b)",
    /`\.indexOf` on an array of structs or arrays/,
  ],
  [
    "includes on an array of arrays",
    "const a: Integer[][] = []; const b: Integer[] = []; const x = a.includes(b);",
    "a.includes(b)",
    /`\.includes` on an array of structs or arrays/,
  ],
  ["union type", "let x: Integer | Text;", "Integer | Text", /union type/i],
];
for (const [name, body, marker, message] of cases) {
  test(`rejects ${name}`, () => {
    const source = `${prefix}function Component() { client.handler(() => { ${body} }); }`;
    rejects(source, marker, message);
  });
}

test("rejects async callbacks", () => {
  const source = `${prefix}function Component() { client.handler(async () => {}); }`;
  rejects(source, "async ()", /async/i);
});

test("rejects generators", () => {
  const source = `${prefix}function Component() { client.handler(function* () {}); }`;
  rejects(source, "function*", /generator/i);
});

test("rejects rest parameters in client.fn", () => {
  const source = `${prefix}const helper = client.fn((...args: Integer[]): void => {});`;
  rejects(source, "...args", /rest/i);
});

test("rejects external imports", () => {
  const source = `${prefix}import { foo } from "external-module";\nfunction Component() { client.handler(() => { foo(); }); }`;
  rejects(source, "foo()", /import/i);
});

test("rejects captured server functions", () => {
  const source = `${prefix}function server() {}\nfunction Component() { client.handler(() => { const x = server; }); }`;
  rejects(source, "server;", /function/i);
});

test("rejects captured server structs", () => {
  const source = `${prefix}interface Data { a: string }\nfunction Component(data: Data) { client.handler(() => { const x = data; }); }`;
  rejects(source, "data;", /objects/i);
});

test("rejects captured Ident values", () => {
  const source = `${prefix}function Component(id: Ident) { client.handler(() => { const x = id; }); }`;
  rejects(source, "id;", /Ident/i);
});

test("allows Object.entries pairs", () => {
  const source = `${prefix}function Component() { client.handler(() => { const rec: Record<string, Integer> = {}; for (const [k, v] of Object.entries(rec)) { console.log(k, v); } }); }`;
  expect(compileSource("test/compiler/rejections.tsx", source).diagnostics).toEqual([]);
});

test("converts unexpected internal errors into diagnostics", () => {
  const spy = spyOn(Analyzer.prototype, "trackStructs").mockImplementation(() => {
    throw new Error("unexpected failure");
  });
  try {
    const result = compileSource(
      "test/compiler/rejections.tsx",
      `${prefix}client.handler(() => {});`,
    );
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "internal-error",
        message: expect.stringMatching(/unexpected failure/),
      }),
    ]);
  } finally {
    spy.mockRestore();
  }
});
