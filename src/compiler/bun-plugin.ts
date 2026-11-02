import path from "node:path";
import ts from "typescript6";
import type { BunPlugin } from "bun";
import { compileSource } from "./index.ts";

export function maniatsxPlugin(opts: { rootDir?: string; tsconfigPath?: string } = {}): BunPlugin {
  const rootDir = path.resolve(
    opts.rootDir ?? (opts.tsconfigPath ? path.dirname(opts.tsconfigPath) : "."),
  );
  return {
    name: "maniatsx",
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, async ({ path: file }) => {
        if (file.split(/[\\/]/).includes("node_modules") || !/\.tsx?$/.test(file)) return;
        const source = await Bun.file(file).text();
        if (
          !ts
            .preProcessFile(source)
            .importedFiles.some((item) => item.fileName === "maniatsx/client")
        )
          return;
        const result = compileSource(file, source, { rootDir });
        const format = (d: (typeof result.diagnostics)[number]) =>
          `${d.file}:${d.line}:${d.column} ${d.message}`;
        for (const warning of result.diagnostics.filter((d) => d.severity === "warning"))
          console.warn(format(warning));
        const errors = result.diagnostics.filter((d) => d.severity === "error");
        if (errors.length) throw new Error(errors.map(format).join("\n"));
        return { contents: result.code, loader: file.endsWith(".tsx") ? "tsx" : "ts" };
      });
    },
  };
}
