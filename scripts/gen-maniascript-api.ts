import {
  generateFromParseResult,
  parse,
  type ClassContent,
  type Documentation,
  type Type,
} from "@maniascript/api";
import { format } from "prettier";
import { fileURLToPath } from "node:url";

const reserved = new Set(
  "break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with implements interface let package private protected public static yield await abstract as asserts any boolean constructor declare get infer is keyof module namespace never number object readonly require global set string symbol type undefined unique unknown from of".split(
    " ",
  ),
);
const renamed = new Set<string>();
function identifier(name: string): string {
  if (!reserved.has(name)) return name;
  renamed.add(name);
  return `${name}_`;
}
function doc(value?: Documentation): string {
  const content = [
    value?.brief,
    value?.description,
    ...(value?.params ?? []).map((p) => `${p.name}: ${p.description ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replaceAll("*/", "* /")
    .trim();
  return content ? `/** ${content} */\n` : "";
}
let knownClasses = new Set<string>();
let scope = "";
function type(t: Type): string {
  switch (t.category) {
    case "literal":
      return t.name!;
    case "class":
      return knownClasses.has(t.name!)
        ? `${t.name} | null`
        : scope === "TimeLib"
          ? `TimeLib_${t.name}`
          : "string";
    case "enum":
      return knownClasses.has(t.namespace!) ? `${t.namespace}.${identifier(t.name!)}` : "string";
    case "array":
      return `(${type(t.type!)})[]`;
  }
}
function members(c: ClassContent): string {
  let out = "";
  for (const [name, v] of Object.entries(c.variables ?? {}))
    out += `${doc(v.documentation)}${v.isConst || v.type.isValueConst || v.type.isPointerConst ? "readonly " : ""}${identifier(name)}: ${type(v.type)};\n`;
  for (const [name, functions] of Object.entries(c.functions ?? {}))
    for (const f of functions) {
      const used = new Set<string>();
      const params = f.parameters.map((p) => {
        let n = identifier(p.name);
        while (used.has(n)) n += "_";
        used.add(n);
        return `${n}: ${type(p.type)}`;
      });
      out += `${doc(f.documentation)}${identifier(name)}(${params.join(", ")}): ${type(f.type)};\n`;
    }
  return out;
}
export async function generate(input: string): Promise<string> {
  renamed.clear();
  const result = parse(input);
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  const api = generateFromParseResult(result);
  knownClasses = new Set(api.classNames);
  function signatures(c: ClassContent, member: string, className: string): string[] {
    scope = className;
    const variable = c.variables?.[member];
    if (variable) return [`property:${type(variable.type)}`];
    return (c.functions?.[member] ?? []).map(
      (f) => `method:(${f.parameters.map((p) => type(p.type)).join(",")}):${type(f.type)}`,
    );
  }
  let body =
    'import type { Integer, Real, Text, Boolean, Void, Ident, Vec2, Vec3, Int2, Int3 } from "./types.ts";\n' +
    'import { clientOnly } from "./client-only.ts";\n';
  for (const name of api.classNames) {
    const c = api.classes[name]!;
    scope = name;
    const conflicts = new Set<string>();
    const names = [...Object.keys(c.variables ?? {}), ...Object.keys(c.functions ?? {})];
    let ancestor = c.parent;
    while (ancestor && api.classes[ancestor]) {
      const inherited = api.classes[ancestor]!;
      for (const member of names) {
        const own = signatures(c, member, name);
        const parentSignatures = signatures(inherited, member, ancestor);
        if (
          parentSignatures.length &&
          (own.length !== parentSignatures.length || own.some((s) => !parentSignatures.includes(s)))
        )
          conflicts.add(identifier(member));
      }
      ancestor = inherited.parent;
    }
    scope = name;
    const parent =
      c.parent && conflicts.size
        ? `Omit<${c.parent}, ${[...conflicts].map((n) => JSON.stringify(n)).join(" | ")}>`
        : c.parent;
    body += `${doc(c.documentation)}export interface ${name}${parent ? ` extends ${parent}` : ""} {\n${members(c)}}\n`;
    if (Object.keys(c.enums ?? {}).length) {
      body += `export const ${name} = Object.freeze({\n`;
      for (const [enumName, e] of Object.entries(c.enums ?? {})) {
        body += `${doc(e.documentation)}${identifier(enumName)}: Object.freeze({\n${e.values.map((v) => `${identifier(v)}: ${JSON.stringify(`${name}::${enumName}::${v}`)},`).join("\n")}\n}),\n`;
      }
      body += `} as const);\nexport namespace ${name} {\n`;
      for (const enumName of Object.keys(c.enums ?? {})) {
        const en = identifier(enumName);
        body += `export type ${en} = (typeof ${name}.${en})[keyof typeof ${name}.${en}];\n`;
      }
      body += "}\n";
    }
  }
  for (const name of api.namespaceNames) {
    scope = name;
    const ns = api.namespaces[name]!;
    for (const [en, e] of Object.entries(ns.enums ?? {})) {
      body += `export type ${name}_${en} = ${e.values.map((v) => JSON.stringify(`${name}::${en}::${v}`)).join(" | ") || "never"};\n`;
    }
    const enums = Object.entries(ns.enums ?? {})
      .map(
        ([en, e]) =>
          `readonly ${identifier(en)}: { ${e.values.map((v) => `readonly ${identifier(v)}: ${JSON.stringify(`${name}::${en}::${v}`)};`).join(" ")} };`,
      )
      .join("\n");
    body += `export const ${name} = clientOnly<{\n${enums}\n${members(ns)} }>("${name}");\n`;
  }
  const build = input.match(/^\s*\*\s*BuildInfo\s*:\s*(.+)$/m)?.[1]?.trim();
  if (!build) throw new Error("Missing BuildInfo");
  return format(
    `// Source: vendor/maniascript/doc.h BuildInfo: ${build}\n// Generated, do not edit. Reserved identifiers suffixed with _: ${[...renamed].sort().join(", ") || "none"}.\n${body}`,
    { parser: "typescript" },
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input = await Bun.file("vendor/maniascript/doc.h").text();
  await Bun.write("src/maniascript/api.generated.ts", await generate(input));
}
