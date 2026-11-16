import ts from "typescript6";
import path from "node:path";
import type { CompiledCode } from "../client/contract.ts";
import { Analyzer, authoringCallKind, unparen } from "./analyzer.ts";
import { Lowerer } from "./lower.ts";
import { toMs } from "./ty.ts";
import { joinItems, type CompileDiagnostic, type HoleSpec, type Item } from "./util.ts";

export type { CompileDiagnostic } from "./util.ts";

// Sites are relative to root so builds are reproducible across machines
function transform(program: ts.Program, files: readonly ts.SourceFile[], root: string) {
  const diagnostics: CompileDiagnostic[] = [];
  const analyzer = new Analyzer(program, program.getTypeChecker(), {
    report(node, code, message, severity = "error") {
      const file = node.getSourceFile();
      const pos = file.getLineAndCharacterOfPosition(node.getStart(file));
      diagnostics.push({
        file: file.fileName,
        line: pos.line + 1,
        column: pos.character + 1,
        code,
        message,
        severity,
      });
    },
  });
  const output = new Map<string, string>();
  for (const file of files) {
    let text = file.text;
    if (
      !file.statements.some(
        (s) =>
          ts.isImportDeclaration(s) &&
          ts.isStringLiteral(s.moduleSpecifier) &&
          s.moduleSpecifier.text === "maniatsx/client",
      )
    ) {
      output.set(file.fileName, text);
      continue;
    }
    const edits: { start: number; end: number; text: string }[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const kind = authoringCallKind(analyzer.checker, node);
        if (kind) {
          const pos = file.getLineAndCharacterOfPosition(node.getStart(file));
          const rel = path.relative(root, file.fileName).split(path.sep).join("/");
          const site = `${rel}:${pos.line + 1}:${pos.character + 1}`;
          const arg = node.arguments[0];
          const hole = (h: HoleSpec) =>
            h.kind === "lib"
              ? `{ kind: "lib", lib: ${JSON.stringify(h.lib)} }`
              : `{ kind: ${JSON.stringify(h.kind)}${h.kind === "value" ? `, type: ${JSON.stringify(h.type)}` : ""}, get: () => (${h.expr}) }`;
          const descriptor = (items: Item[], structs: string[] = []) => {
            const { code, holes } = joinItems(items);
            return `{ code: ${JSON.stringify(code)}, holes: [${holes.map(hole).join(", ")}], structs: ${JSON.stringify(structs)}, site: ${JSON.stringify(site)} }`;
          };
          let replacement: string | undefined;
          if (kind === "ref") {
            const ty = analyzer.refClassTy(node, node);
            if (typeof ty === "object" && "class" in ty)
              replacement = `__mtx.ref(${JSON.stringify(ty.class)}, ${JSON.stringify(site)})`;
          } else if (kind === "state" && arg) {
            const type = toMs(analyzer.stateArgTy(node, node));
            const options = stateOptions(analyzer, node.arguments[1]);
            if (type && options !== null)
              replacement = `__mtx.state(${JSON.stringify(type)}, ${descriptor([{ kind: "value", type, expr: arg.getText(file) }])}, ${JSON.stringify(site)}${options ? `, ${JSON.stringify(options)}` : ""})`;
          } else if (arg) {
            const closure = unparen(arg);
            if (ts.isArrowFunction(closure) || ts.isFunctionExpression(closure)) {
              if (closure.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))
                analyzer.report(
                  closure,
                  "async",
                  "Async functions are not supported in client code.",
                );
              if (closure.asteriskToken)
                analyzer.report(
                  closure,
                  "generator",
                  "Generators are not supported in client code.",
                );
              for (const param of closure.parameters) {
                if (param.dotDotDotToken)
                  analyzer.report(
                    param.dotDotDotToken,
                    "rest",
                    "Rest parameters are not supported in client code.",
                  );
              }
              const decl = node.parent;
              const sig =
                kind === "fn" && ts.isVariableDeclaration(decl)
                  ? analyzer.fnSig(node, decl)
                  : undefined;
              const lowerer = new Lowerer(
                analyzer,
                closure,
                kind === "onInit"
                  ? "init"
                  : kind === "onFrame"
                    ? "frame"
                    : kind === "state"
                      ? "handler"
                      : kind,
                sig,
              );
              const tracked = analyzer.trackStructs(() =>
                kind === "bind"
                  ? lowerer.lowerBind(undefined)
                  : {
                      items:
                        kind === "fn" && sig
                          ? lowerer.lowerFn()
                          : kind === "onInit" || kind === "onFrame"
                            ? lowerer.lowerLifecycle()
                            : lowerer.lowerStatements(),
                      ty: undefined,
                    },
              );
              const code = descriptor(tracked.result.items, tracked.structs);
              if (kind === "bind") {
                const type = tracked.result.ty && toMs(tracked.result.ty);
                if (type) replacement = `__mtx.bind(${JSON.stringify(type)}, ${code})`;
                else analyzer.report(node, "bind-type", "Cannot determine binding type.");
              } else if (kind === "fn" && sig)
                replacement = `__mtx.fn(${JSON.stringify(sig.name)}, ${code})`;
              else replacement = `__mtx.${kind}(${code})`;
            } else analyzer.report(node, "closure", "Expected a function expression.");
          }
          if (replacement)
            edits.push({ start: node.getStart(file), end: node.end, text: replacement });
          return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    for (const edit of edits.sort((a, b) => b.start - a.start))
      text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    if (edits.length) text = `import { __mtx } from "maniatsx/client";\n` + text;
    output.set(file.fileName, text);
  }
  return { output, diagnostics };
}

// Options must be literals so the compiler can bake them in; null means an error was reported
function stateOptions(
  analyzer: Analyzer,
  node: ts.Expression | undefined,
): { persist: true; key?: string } | undefined | null {
  if (!node) return undefined;
  const bad = (at: ts.Node, message: string) => {
    analyzer.report(at, "state-options", message);
    return null;
  };
  const literal = unparen(node);
  if (!ts.isObjectLiteralExpression(literal))
    return bad(node, "client.state options must be an object literal like `{ persist: true }`.");
  let persist = false;
  let key: string | undefined;
  for (const prop of literal.properties) {
    const name = ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) ? prop.name.text : "";
    const value = ts.isPropertyAssignment(prop) ? unparen(prop.initializer) : undefined;
    if (name === "persist" && value) {
      if (value.kind === ts.SyntaxKind.TrueKeyword) persist = true;
      else if (value.kind !== ts.SyntaxKind.FalseKeyword)
        return bad(value, "`persist` must be the literal `true` or `false`.");
    } else if (name === "key" && value) {
      if (!ts.isStringLiteralLike(value)) return bad(value, "`key` must be a string literal.");
      if (!/^[A-Za-z]\w*$/.test(value.text))
        return bad(
          value,
          "`key` may only contain letters, digits and `_`, and must start with a letter.",
        );
      key = value.text;
    } else return bad(prop, "client.state options support only `persist` and `key` as literals.");
  }
  if (key !== undefined && !persist) return bad(node, "`key` only applies with `persist: true`.");
  return persist ? { persist: true, ...(key !== undefined && { key }) } : undefined;
}

export function compileSource(
  fileName: string,
  sourceText: string,
  opts: { rootDir?: string } = {},
) {
  const root = path.resolve(opts.rootDir ?? process.cwd());
  const name = path.resolve(root, fileName);
  try {
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: "maniatsx",
      baseUrl: root,
      paths: {
        "maniatsx/client": ["src/client/index.ts"],
        "maniatsx/maniascript": ["src/maniascript/index.ts"],
        "maniatsx/jsx-runtime": ["src/jsx-runtime.ts"],
      },
      skipLibCheck: true,
    };
    const host = ts.createCompilerHost(options);
    const read = host.readFile.bind(host),
      exists = host.fileExists.bind(host);
    host.readFile = (f) => (path.resolve(f) === name ? sourceText : read(f));
    host.fileExists = (f) => path.resolve(f) === name || exists(f);
    const program = ts.createProgram([name], options, host);
    const result = transform(program, [program.getSourceFile(name)!], root);
    return { code: result.output.get(name)!, diagnostics: result.diagnostics };
  } catch (error) {
    return {
      code: sourceText,
      diagnostics: [
        {
          file: name,
          line: 1,
          column: 1,
          code: "internal-error",
          severity: "error" as const,
          message: `Internal compiler error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

export function compileProject({ tsconfigPath }: { tsconfigPath: string }) {
  const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(path.resolve(tsconfigPath)),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const result = transform(
    program,
    parsed.fileNames.map((f) => program.getSourceFile(f)).filter((f): f is ts.SourceFile => !!f),
    path.dirname(path.resolve(tsconfigPath)),
  );
  return { files: result.output, diagnostics: result.diagnostics };
}

export function debugEmit(code: CompiledCode, values: unknown[] = []): string {
  return code.holes.reduce(
    (out, hole, i) =>
      out +
      (hole.kind === "lib"
        ? hole.lib
        : hole.kind === "value"
          ? i in values
            ? JSON.stringify(values[i])
            : `<hole ${i}>`
          : `<${hole.kind}>`) +
      code.code[i + 1],
    code.code[0] ?? "",
  );
}
