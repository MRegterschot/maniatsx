// Generates src/generated/intrinsics.ts from vendor/manialink_v3.xsd. Run with `bun run gen`.
import { XMLParser } from "fast-xml-parser";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const xsdPath = join(root, "vendor", "manialink_v3.xsd");
const outPath = join(root, "src", "generated", "intrinsics.ts");

type Xml = Record<string, any>;

const arrayTags = new Set([
  "xs:simpleType",
  "xs:attributeGroup",
  "xs:attribute",
  "xs:element",
  "xs:enumeration",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => arrayTags.has(name),
});

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function docOf(node: Xml): string | undefined {
  const d = node?.["xs:annotation"]?.["xs:documentation"];
  const text = typeof d === "string" ? d : d?.["#text"];
  return text ? squash(text) : undefined;
}

const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join("");

const propName = (n: string) => (/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n));

const doc = (text: string | undefined) => (text ? `/** ${text.replace(/\*\//g, "*\\/")} */\n` : "");

const xsd: Xml = parser.parse(readFileSync(xsdPath, "utf8").replace(/^﻿/, ""))["xs:schema"];

// Simple types

interface SimpleType {
  name: string;
  doc?: string;
  base: string;
  values: string[];
}

const simpleTypes = new Map<string, SimpleType>();
for (const st of arr<Xml>(xsd["xs:simpleType"])) {
  const r = st["xs:restriction"] ?? {};
  simpleTypes.set(st["@_name"], {
    name: st["@_name"],
    doc: docOf(st),
    base: r["@_base"] ?? "xs:string",
    values: arr<Xml>(r["xs:enumeration"]).map((e) => e["@_value"]),
  });
}

const BUILTIN_STRING = new Set(["string", "token", "anyURI", "NCName", "normalizedString", "ID"]);
const BUILTIN_NUMBER = new Set([
  "float",
  "double",
  "decimal",
  "int",
  "integer",
  "long",
  "short",
  "byte",
  "positiveInteger",
  "nonNegativeInteger",
  "unsignedInt",
]);
// Custom types whose meaning lives in the documentation or pattern, not the base type
const CUSTOM_TS: Record<string, string> = {
  type_color: "Color",
  type_floatPositive: "number",
  type_real: "number",
  type_float2: "Vec2 | string",
  type_float2positive: "Vec2 | string",
  type_float3: "string",
};

const unknownTypes = new Set<string>();
const enumNames = new Map<string, string>();

function enumName(st: SimpleType): string {
  return pascal(st.name.replace(/^type_/, ""));
}

function mapType(type: string | undefined): string {
  if (!type) return "string";
  if (type.startsWith("xs:")) {
    const b = type.slice(3);
    if (BUILTIN_STRING.has(b)) return "string";
    if (BUILTIN_NUMBER.has(b)) return "number";
    if (b === "boolean") return "boolean";
    unknownTypes.add(type);
    return "string";
  }
  const custom = CUSTOM_TS[type];
  if (custom) return custom;
  const st = simpleTypes.get(type);
  if (!st) {
    unknownTypes.add(type);
    return "string";
  }
  if (st.values.length > 0) {
    // 0/1 enumerations are booleans
    if (st.values.length === 2 && st.values.includes("0") && st.values.includes("1")) {
      return "boolean";
    }
    return enumName(st);
  }
  return mapType(st.base);
}

// Attribute groups and elements

interface Attr {
  name: string;
  ts: string;
  doc?: string;
  required: boolean;
}

function toAttr(a: Xml): Attr {
  const name: string = a["@_name"];
  let ts = mapType(a["@_type"]);
  if (name === "class") ts = "string | readonly string[]";
  return { name, ts, doc: docOf(a), required: a["@_use"] === "required" };
}

interface Group {
  name: string;
  iface: string;
  attrs: Attr[];
}

const groups = new Map<string, Group>();
for (const g of arr<Xml>(xsd["xs:attributeGroup"])) {
  groups.set(g["@_name"], {
    name: g["@_name"],
    iface: pascal(g["@_name"]),
    attrs: arr<Xml>(g["xs:attribute"]).map(toAttr),
  });
}

type Content = "container" | "text" | "script" | "none";

interface Element {
  name: string;
  doc?: string;
  groups: string[];
  attrs: Attr[];
  content: Content;
  textType?: string;
}

const elements = new Map<string, Element>();

const hasChildElements = (ct: Xml) =>
  ["xs:choice", "xs:sequence", "xs:all"].some((k) => ct[k] !== undefined);

// Collects the choice/sequence particles that declare nested elements
function nestedOf(node: Xml): Xml[] {
  const out: Xml[] = [];
  for (const k of ["xs:choice", "xs:sequence", "xs:all"]) {
    for (const c of arr<Xml>(node[k])) {
      out.push(...arr<Xml>(c["xs:element"]));
      out.push(...nestedOf(c));
    }
  }
  return out;
}

function addElement(el: Xml, topLevel: boolean) {
  const name: string = el["@_name"];
  if (!name) return; // ref=… particles point at a top-level definition
  if (elements.has(name) && !topLevel) return;

  const ct: Xml | undefined = el["xs:complexType"];
  const sc: Xml | undefined = ct?.["xs:simpleContent"]?.["xs:extension"];
  const body = sc ?? ct;

  let content: Content = "none";
  let textType: string | undefined;
  const inlineSimple = arr<Xml>(el["xs:simpleType"])[0];
  if (inlineSimple) {
    content = "text";
    textType = mapType(inlineSimple["xs:restriction"]?.["@_base"]);
  } else if (sc) {
    content = "text";
    textType = mapType(sc["@_base"]);
  } else if (ct && hasChildElements(ct)) {
    content = "container";
  } else if (!ct && !el["@_type"]) {
    // Untyped element is xs:anyType, which here only occurs for <script>
    content = "script";
  }

  const attrNodes = body ? arr<Xml>(body["xs:attribute"]) : [];
  const groupRefs = body ? arr<Xml>(body["xs:attributeGroup"]).map((g) => g["@_ref"]) : [];

  elements.set(name, {
    name,
    doc: docOf(el),
    groups: groupRefs,
    attrs: attrNodes.map(toAttr),
    content,
    textType,
  });

  if (ct) for (const child of nestedOf(ct)) addElement(child, false);
}

for (const el of arr<Xml>(xsd["xs:element"])) addElement(el, true);

// Output

const childrenFor = (el: Element): string => {
  switch (el.content) {
    case "container":
      return "children?: Node;";
    case "script":
      return "children?: string | MsCode | readonly (string | MsCode)[];";
    case "text":
      return `children?: ${el.textType};`;
    default:
      return "children?: never;";
  }
};

const renderAttrs = (attrs: Attr[]) =>
  attrs.map((a) => `${doc(a.doc)}${propName(a.name)}${a.required ? "" : "?"}: ${a.ts};`).join("\n");

const out: string[] = [];
out.push(`// GENERATED FILE. Do not edit; run \`bun run gen\` to regenerate.
// Source: vendor/manialink_v3.xsd (reaby/manialink-xsd, MIT, commit c327ecbdf19d).
import type { Color, MsCode, Node, Vec2 } from "../vnode.ts";`);

for (const st of [...simpleTypes.values()].filter((s) => s.values.length > 0)) {
  if (st.values.length === 2 && st.values.includes("0") && st.values.includes("1")) continue;
  enumNames.set(st.name, enumName(st));
  out.push(
    `${doc(st.doc)}export type ${enumName(st)} = ${st.values.map((v) => JSON.stringify(v)).join(" | ")};`,
  );
}

for (const g of groups.values()) {
  out.push(`${doc(`Shared attribute group \`${g.name}\`.`)}export interface ${g.iface} {
${renderAttrs(g.attrs)}
}`);
}

const names = [...elements.keys()].sort();
for (const n of names) {
  const el = elements.get(n)!;
  const iface = `${pascal(n)}Attributes`;
  const exts = el.groups.map((g) => {
    const grp = groups.get(g);
    if (!grp) throw new Error(`Unknown attributeGroup ref "${g}" on <${n}>`);
    return grp.iface;
  });
  out.push(`${doc(el.doc ?? `Attributes of the \`<${n}>\` element.`)}export interface ${iface}${
    exts.length ? ` extends ${exts.join(", ")}` : ""
  } {
${renderAttrs(el.attrs)}
${childrenFor(el)}
}`);
}

out.push(`export interface GeneratedIntrinsicElements {
${names.map((n) => `${propName(n)}: ${pascal(n)}Attributes;`).join("\n")}
}`);

const config = (await prettier.resolveConfig(outPath)) ?? {};
const formatted = await prettier.format(out.join("\n\n") + "\n", {
  ...config,
  filepath: outPath,
});
writeFileSync(outPath, formatted);

const attrCount =
  [...groups.values()].reduce((n, g) => n + g.attrs.length, 0) +
  [...elements.values()].reduce((n, e) => n + e.attrs.length, 0);
console.log(
  `gen-intrinsics: ${names.length} elements, ${groups.size} attribute groups, ${attrCount} attributes, ${enumNames.size} enums`,
);
if (unknownTypes.size > 0) {
  console.warn(
    `gen-intrinsics: WARNING unknown XSD types mapped to string: ${[...unknownTypes].sort().join(", ")}`,
  );
} else {
  console.log("gen-intrinsics: unknown XSD types: none");
}
