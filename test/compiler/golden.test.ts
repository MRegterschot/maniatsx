import { expect, test } from "bun:test";
import { Glob } from "bun";
import { compileSnippets } from "../support/compile.ts";
import { parseManiaScript } from "../support/maniascript.ts";

const fixtures = "test/compiler/fixtures/golden";
const goldens = "test/compiler/golden";

const cases = Array.from(new Glob("*.tsx").scanSync(fixtures))
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

const withHeader = (s: { header: string }, body: string) =>
  s.header ? `${s.header}\n\n${body}` : body;

for (const name of cases) {
  test(`golden: ${name}`, async () => {
    const file = `${fixtures}/${name}.tsx`;
    const { snippets, diagnostics } = compileSnippets(file, await Bun.file(file).text());
    expect(diagnostics).toEqual([]);
    expect(snippets.length).toBeGreaterThan(0);
    const output = snippets.map((s) => withHeader(s, s.ms.trimEnd())).join("\n\n") + "\n";
    // Function definitions are top level; statements need a main() around them
    for (const s of snippets) {
      const body = s.kind === "fn" ? `${s.ms}\nmain() {}` : `main() {\n${s.ms}\n}`;
      const script = withHeader(s, body);
      expect(parseManiaScript(script).errors).toEqual([]);
    }
    const target = `${goldens}/${name}.ms`;
    if (process.env.UPDATE_GOLDEN) await Bun.write(target, output);
    else expect(output).toBe(await Bun.file(target).text());
  });
}
