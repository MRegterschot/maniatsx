import { test, expect } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { Manialink, render } from "../../src/index.ts";
import { compileSource } from "../../src/compiler/index.ts";
import { extractScripts, parseManiaScript } from "../support/maniascript.ts";

test("compiled counter renders a valid script", async () => {
  const file = "test/compiler/fixtures/counter.tsx";
  const result = compileSource(file, await Bun.file(file).text());
  expect(result.diagnostics).toEqual([]);
  const dir = "test/compiler/.tmp";
  await mkdir(dir, { recursive: true });
  const target = `${dir}/counter.tsx`;
  try {
    await Bun.write(target, result.code);
    const { Counter } = await import(`./.tmp/${"counter"}.tsx`);
    const xml = render(
      <Manialink id="counter">
        <Counter title="Hi" start={3} />
      </Manialink>,
    );
    const script = extractScripts(xml)[0]!;
    expect(xml).toContain('text="Hi"');
    expect(script).toContain("declare Integer Mtx_S1;");
    expect(script).toContain("Mtx_S1 = 3;");
    expect(script.match(/Event.ControlId ==/g)).toHaveLength(2);
    expect(script).toContain("Mtx_S1 += 1;");
    expect(script).toContain("Mtx_Dirty = True;");
    expect(script).toContain('TriggerPageAction("counter-reset")');
    expect(script).toContain('Mtx_C1.Value = "Clicks: " ^ Mtx_S1;');
    expect(parseManiaScript(script).errors).toEqual([]);
  } finally {
    await rm(target, { force: true });
  }
});

test("compiled lifecycle and hidden binding render valid script", async () => {
  const file = "test/compiler/fixtures/lifecycle.tsx";
  const result = compileSource(file, await Bun.file(file).text());
  expect(result.diagnostics).toEqual([]);
  const target = "test/compiler/.tmp/lifecycle.tsx";
  await mkdir("test/compiler/.tmp", { recursive: true });
  try {
    await Bun.write(target, result.code);
    const { Lifecycle } = await import(`./.tmp/${"lifecycle"}.tsx`);
    const script = extractScripts(
      render(
        <Manialink id="lifecycle">
          <Lifecycle />
        </Manialink>,
      ),
    )[0]!;
    expect(script).toContain('GetFirstChild("status")');
    expect(script).toContain("TextLib::ToUpperCase");
    expect(script).toContain("foreach");
    expect(script).toContain(".Visible = !");
    expect(parseManiaScript(script).errors).toEqual([]);
  } finally {
    await rm(target, { force: true });
  }
});
