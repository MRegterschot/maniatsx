import { compileSource, debugEmit } from "../../src/compiler/index.ts";
import type { CompiledCode } from "../../src/client/contract.ts";

// debugEmit prints fn holes as <fn>; inline their names so the snippet reads like the real output
function inlineFns(code: CompiledCode): CompiledCode {
  const text = [code.code[0]!];
  const holes: CompiledCode["holes"][number][] = [];
  code.holes.forEach((hole, i) => {
    if (hole.kind === "fn") text[text.length - 1] += hole.get().name + code.code[i + 1];
    else {
      holes.push(hole);
      text.push(code.code[i + 1]!);
    }
  });
  return { ...code, code: text, holes };
}

export interface Snippet {
  kind: string;
  ms: string;
  // `#Include` and `#Struct` lines the snippet needs, as they appear above the code
  header: string;
}

// Compiles a source and evaluates the rewritten module against a recorder, returning each emitted snippet
export function compileSnippets(file: string, source: string) {
  const result = compileSource(file, source);
  const snippets: Snippet[] = [];
  if (result.diagnostics.length) return { snippets, diagnostics: result.diagnostics };
  // Holes resolve after the module ran, so recursive fns can reference their own handle
  const recorded: { kind: string; code: CompiledCode }[] = [];
  const record =
    (kind: string, pick: (args: unknown[]) => CompiledCode) =>
    (...args: unknown[]) => {
      recorded.push({ kind, code: pick(args) });
      return kind === "fn" ? { name: args[0] } : {};
    };
  const last = (args: unknown[]) => args[args.length - 1] as CompiledCode;
  const mtx = {
    onInit: record("init", last),
    onFrame: record("frame", last),
    handler: record("handler", last),
    fn: record("fn", last),
    bind: record("bind", last),
    state: record("state", (args) => args[1] as CompiledCode),
  };
  const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(
    result.code.replace(/^import .*;$/gm, "").replace(/^export /gm, ""),
  );
  new Function("__mtx", js)(mtx);
  for (const r of recorded)
    snippets.push({
      kind: r.kind,
      ms: debugEmit(inlineFns(r.code)),
      header: [
        ...r.code.includes.map(([lib, alias]) => `#Include "${lib}" as ${alias}`),
        ...r.code.structs,
      ].join("\n"),
    });
  return { snippets, diagnostics: result.diagnostics };
}
