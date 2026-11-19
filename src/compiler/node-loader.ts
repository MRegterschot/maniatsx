import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript6";
import { compilePluginLoad, formatDiagnostic } from "./plugin-shared.ts";

const TS_FILE = /\.m?tsx?$/;
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

// Lets plain Node import .ts/.tsx modules (the CLI's module argument), compiling client code like the bundler plugins
export function registerTsxLoader(rootDir: string): void {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        // Bun-style relative imports: "./x" or "./x.js" for a TS source
        if (
          !/^\.{1,2}\//.test(specifier) ||
          (error as { code?: string }).code !== "ERR_MODULE_NOT_FOUND"
        )
          throw error;
        const base = specifier.replace(/\.[cm]?js$/, "");
        for (const extension of EXTENSIONS) {
          try {
            return nextResolve(base + extension, context);
          } catch {}
        }
        throw error;
      }
    },
    load(url, context, nextLoad) {
      if (!url.startsWith("file:") || !TS_FILE.test(url)) return nextLoad(url, context);
      const file = fileURLToPath(url);
      if (file.split(/[\\/]/).includes("node_modules")) return nextLoad(url, context);
      let source = readFileSync(file, "utf8");
      const compiled = compilePluginLoad(file, source, rootDir);
      if (compiled) {
        for (const warning of compiled.diagnostics.filter((d) => d.severity === "warning"))
          console.warn(formatDiagnostic(warning));
        const errors = compiled.diagnostics.filter((d) => d.severity === "error");
        if (errors.length) throw new Error(errors.map(formatDiagnostic).join("\n"));
        source = compiled.code;
      }
      const output = ts.transpileModule(source, {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          jsxImportSource: "maniatsx",
          sourceMap: false,
          inlineSourceMap: true,
        },
      });
      return { format: "module", source: output.outputText, shortCircuit: true };
    },
  });
}
