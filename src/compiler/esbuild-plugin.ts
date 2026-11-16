import path from "node:path";
import { readFile } from "node:fs/promises";
import { compilePluginLoad } from "./plugin-shared.ts";

interface EsbuildMessage {
  text: string;
  location?: { file: string; line: number; column: number; length?: number; lineText?: string };
}
interface EsbuildBuild {
  onLoad(
    options: { filter: RegExp },
    callback: (args: { path: string }) => Promise<{
      contents?: string;
      loader?: "ts" | "tsx";
      errors?: EsbuildMessage[];
      warnings?: EsbuildMessage[];
    } | null>,
  ): void;
}
export interface EsbuildPluginOptions {
  rootDir?: string;
  tsconfigPath?: string;
}
export interface EsbuildPlugin {
  name: string;
  setup(build: EsbuildBuild): void;
}

export function maniatsxEsbuildPlugin(options: EsbuildPluginOptions = {}): EsbuildPlugin {
  const rootDir = path.resolve(
    options.rootDir ?? (options.tsconfigPath ? path.dirname(options.tsconfigPath) : "."),
  );
  return {
    name: "maniatsx",
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, async ({ path: file }) => {
        const source = await readFile(file, "utf8");
        const loader = file.endsWith("x") ? "tsx" : "ts";
        const result = compilePluginLoad(file, source, rootDir);
        if (!result) return { contents: source, loader };
        const messages = (severity: "error" | "warning") =>
          result.diagnostics
            .filter((d) => d.severity === severity)
            .map((d) => ({
              text: d.message,
              location: { file: d.file, line: d.line, column: Math.max(0, d.column - 1) },
            }));
        const errors = messages("error");
        if (errors.length) return { errors, warnings: messages("warning") };
        return { contents: result.code, loader, warnings: messages("warning") };
      });
    },
  };
}
