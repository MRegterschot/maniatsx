import ts from "typescript6";
import { compileSource } from "./index.ts";

export function compilePluginLoad(
  file: string,
  source: string,
  rootDir: string,
  keyPrefix?: string,
) {
  if (file.split(/[\\/]/).includes("node_modules") || !/\.tsx?$/.test(file)) return null;
  if (!ts.preProcessFile(source).importedFiles.some((item) => item.fileName === "maniatsx/client"))
    return null;
  return compileSource(file, source, { rootDir, keyPrefix });
}

export function formatDiagnostic(d: {
  file: string;
  line: number;
  column: number;
  message: string;
}) {
  return `${d.file}:${d.line}:${d.column} ${d.message}`;
}
