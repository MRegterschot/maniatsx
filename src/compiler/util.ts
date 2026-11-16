import type { MsType } from "../client/contract.ts";

export interface CompileDiagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
  severity: "error" | "warning";
}

// A hole as the compiler knows it: `expr` is the original source text evaluated at render time.
export type HoleSpec =
  | { kind: "value"; type: MsType; expr: string }
  | { kind: "state" | "shared" | "fn" | "action" | "ref"; expr: string }
  | { kind: "lib"; lib: string };

// Lib qualifier hole; the runtime picks the alias, so compiled code works with any #Include ... as X
export const libRef = (lib: string): Item => ({ kind: "lib", lib });

export type Item = string | HoleSpec;

export function joinItems(items: readonly Item[]): { code: string[]; holes: HoleSpec[] } {
  const code: string[] = [""];
  const holes: HoleSpec[] = [];
  for (const item of items) {
    if (typeof item === "string") code[code.length - 1] += item;
    else {
      holes.push(item);
      code.push("");
    }
  }
  return { code, holes };
}

export const norm = (path: string) => path.replace(/\\/g, "/");

// ManiaScript text literal; "--" is split because the script lives in an XML comment (see src/ms.ts)
export function stringLiteral(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/-(?=-)/g, '-" ^ "');
  return `"${escaped}"`;
}

// Expands exponent notation so the literal is valid ManiaScript
export function decimal(n: number): string {
  const s = String(n);
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (!m) return s;
  const digits = m[2]! + (m[3] ?? "");
  const point = 1 + Number(m[4]);
  let body: string;
  if (point <= 0) body = "0." + "0".repeat(-point) + digits;
  else if (point >= digits.length) body = digits + "0".repeat(point - digits.length);
  else body = digits.slice(0, point) + "." + digits.slice(point);
  return m[1]! + body;
}

export function realLiteral(n: number): string {
  const s = decimal(n);
  return s.includes(".") ? s : s + ".";
}

export const RESERVED = new Set([
  "as",
  "assert",
  "break",
  "case",
  "cast",
  "continue",
  "declare",
  "default",
  "dump",
  "dumptype",
  "else",
  "for",
  "foreach",
  "if",
  "in",
  "is",
  "let",
  "log",
  "main",
  "meanwhile",
  "return",
  "sleep",
  "switch",
  "wait",
  "while",
  "yield",
]);

// Keeps lowercase-first user names; anything that could clash with ManiaScript gets an L_ prefix
export function safeLocalName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (/^[a-z]/.test(clean) && !RESERVED.has(clean)) return clean;
  return "L_" + clean.replace(/^_+/, "");
}
