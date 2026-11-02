import { expect, test } from "bun:test";
import { maniatsxPlugin } from "../../src/compiler/bun-plugin.ts";

const fixture = (name: string) => `test/compiler/fixtures/p2-5-${name}`;

test("Bun.build compiles a counter and renders its script", async () => {
  const result = await Bun.build({
    entrypoints: [fixture("entry.tsx")],
    plugins: [maniatsxPlugin()],
    target: "bun",
  });
  expect(result.success).toBe(true);
  const bundle = await result.outputs[0]!.text();
  const proc = Bun.spawn(["bun", "-e", `${bundle}\nconsole.log(xml);`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const errors = await new Response(proc.stderr).text();
  expect({ exit: await proc.exited, errors }).toEqual({ exit: 0, errors: "" });
  expect(output).toContain("declare Integer Mtx_S1;");
  expect(output).toContain("Mtx_S1 += 1;");
});

test("compiler diagnostics fail the build", async () => {
  let message = "";
  try {
    const result = await Bun.build({
      entrypoints: [fixture("error.tsx")],
      plugins: [maniatsxPlugin()],
    });
    expect(result.success).toBe(false);
    message = result.logs.join("\n");
  } catch (error) {
    message = error instanceof AggregateError ? error.errors.map(String).join("\n") : String(error);
  }
  expect(message).toContain("p2-5-error.tsx:3:");
});

test("files without the client import pass through", async () => {
  const result = await Bun.build({
    entrypoints: [fixture("plain.ts")],
    plugins: [maniatsxPlugin()],
  });
  expect(result.success).toBe(true);
  expect(await result.outputs[0]!.text()).toContain("untouched");
});
