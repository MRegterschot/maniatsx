import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { jsx } from "./jsx-runtime.ts";
import { render } from "./render.ts";
import { VNODE, type Node, type VNode } from "./vnode.ts";

const usage =
  "Usage: maniatsx <module.tsx> [--export <name>] [--props <json>] [--pretty] [--no-prolog-check] [--out <file>] [--warn-bytes <n>]";

async function main(args: string[]): Promise<void> {
  let modulePath: string | undefined;
  let exportName = "default";
  let props: Record<string, unknown> = {};
  let pretty = false;
  let prologCheck = true;
  let out: string | undefined;
  let warnBytes: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--help") {
      console.log(usage);
      return;
    }
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "--no-prolog-check") {
      prologCheck = false;
      continue;
    }
    if (["--export", "--props", "--out", "--warn-bytes"].includes(arg)) {
      const value = args[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      if (arg === "--export") exportName = value;
      if (arg === "--out") out = value;
      if (arg === "--warn-bytes") {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
          throw new Error("--warn-bytes must be a non-negative integer");
        warnBytes = Number(value);
      }
      if (arg === "--props") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new Error("--props must be a valid JSON object");
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("--props must be a JSON object");
        props = parsed as Record<string, unknown>;
      }
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (modulePath) throw new Error(`Unexpected argument: ${arg}`);
    modulePath = arg;
  }
  if (!modulePath) throw new Error(`A module path is required. ${usage}`);
  const exports: Record<string, unknown> = await import(pathToFileURL(resolve(modulePath)).href);
  const selected = exports[exportName];
  const available = Object.keys(exports).join(", ") || "(none)";
  let xml: string;
  let renderedString = false;
  if (typeof selected === "function") {
    let result: string | undefined;
    const component = () => {
      const value: unknown = selected(props);
      if (typeof value === "string") {
        result = value;
        return null;
      }
      return value as Node;
    };
    xml = render(jsx(component, {}), {
      pretty,
      warnBytes,
      onWarning: (message) => console.error(message),
    });
    if (result !== undefined) {
      xml = result;
      renderedString = true;
    }
  } else if (typeof selected === "string") {
    xml = selected;
    renderedString = true;
  } else if (
    typeof selected === "object" &&
    selected !== null &&
    (selected as VNode).$$typeof === VNODE
  ) {
    xml = render(selected as VNode, {
      pretty,
      warnBytes,
      onWarning: (message) => console.error(message),
    });
  } else {
    throw new Error(
      `Export ${JSON.stringify(exportName)} is missing or unsupported. Available exports: ${available}`,
    );
  }
  const bytes = new TextEncoder().encode(xml).length;
  if (renderedString && warnBytes !== undefined && bytes > warnBytes) {
    console.error(`Output is ${bytes} bytes, over the warnBytes limit of ${warnBytes}`);
  }
  if (prologCheck && !/^\s*<\?xml\s/.test(xml)) console.error("Warning: XML prolog is missing");
  if (out) await Bun.write(resolve(out), xml);
  else process.stdout.write(xml);
  console.error(`Output: ${bytes} bytes`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    process.env.MANIATSX_DEBUG === "1" && error instanceof Error
      ? error.stack
      : message.replace(/[\r\n]+/g, " "),
  );
  process.exitCode = 1;
});
