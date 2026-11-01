import { MS_CODE, type MsCode } from "./vnode.ts";

export type MsValue = number | string | boolean | MsCode | readonly MsValue[];

function code(text: string): MsCode {
  return Object.freeze({ $$typeof: MS_CODE, code: text });
}

function isMsCode(value: unknown): value is MsCode {
  return typeof value === "object" && value !== null && (value as MsCode).$$typeof === MS_CODE;
}

// String(n) is the shortest round-trip form but may use an exponent; expand it.
function decimal(n: number): string {
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

function finite(n: unknown, where: string): number {
  if (typeof n !== "number") throw new TypeError(`${where} expects a number, got ${typeof n}`);
  if (!Number.isFinite(n)) throw new RangeError(`${where} expects a finite number, got ${n}`);
  return n;
}

function realText(n: number, where: string): string {
  const s = decimal(finite(n, where));
  return s.includes(".") ? s : s + ".";
}

function intText(n: number, where: string): string {
  if (!Number.isInteger(finite(n, where)))
    throw new RangeError(`${where} expects an integer, got ${n}`);
  // ManiaScript Integer is 32-bit signed
  if (n < -2147483648 || n > 2147483647)
    throw new RangeError(`${where} is outside the 32-bit Integer range: ${n}`);
  return decimal(n);
}

function stringText(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    // "-->" would close the script's XML comment, so split it with a concat
    .replace(/-->/g, '--" ^ ">');
  return `"${escaped}"`;
}

function kindOf(value: unknown): string {
  if (isMsCode(value)) return "code";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function literal(value: unknown, where: string): string {
  if (typeof value === "number") {
    return Number.isInteger(finite(value, where)) ? intText(value, where) : decimal(value);
  }
  if (typeof value === "string") return stringText(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (isMsCode(value)) return value.code;
  if (Array.isArray(value)) {
    if (value.length === 0)
      throw new TypeError(`${where} is an empty array; ManiaScript needs a typed literal`);
    const first = kindOf(value[0]);
    const items = value.map((item, i) => {
      if (kindOf(item) !== first) {
        throw new TypeError(`${where} mixes ${first} and ${kindOf(item)} items (item ${i})`);
      }
      return literal(item, `${where}[${i}]`);
    });
    return `[${items.join(", ")}]`;
  }
  const what = value === null ? "null" : typeof value;
  throw new TypeError(`${where} cannot be turned into ManiaScript: got ${what}`);
}

// Strips common indentation and blank edge lines; works on the literal parts so interpolated text stays as is.
export function dedentParts(parts: readonly string[]): string[] {
  if (!parts.some((p) => p.includes("\n"))) return [...parts];
  let min = Infinity;
  parts.forEach((part, k) => {
    const lines = part.split("\n");
    lines.forEach((line, j) => {
      if (j === 0 && k > 0) return;
      const lastOfOpen = j === lines.length - 1 && k < parts.length - 1;
      if (line.trim() === "" && !lastOfOpen) return;
      min = Math.min(min, line.length - line.trimStart().length);
    });
  });
  if (min === Infinity) min = 0;
  const out = parts.map((part, k) =>
    part
      .split("\n")
      .map((line, j) =>
        j === 0 && k > 0 ? line : line.slice(Math.min(min, line.length - line.trimStart().length)),
      )
      .join("\n"),
  );
  out[0] = out[0]!.replace(/^([ \t]*\n)+/, "");
  const last = out.length - 1;
  out[last] = out[last]!.replace(/(\n[ \t]*)+$/, "");
  return out;
}

export function dedent(text: string): string {
  return dedentParts([text.replace(/\r\n?/g, "\n")])[0]!;
}

export interface Ms {
  (strings: TemplateStringsArray, ...values: MsValue[]): MsCode;
  /** Real literal that always has a dot: `1.`, `1.5`. */
  real(n: number): MsCode;
  /** Integer literal; throws for non-integers. */
  int(n: number): MsCode;
  /** Vec2 literal `<x, y>` of reals. */
  vec2(x: number, y: number): MsCode;
  /** Trusted ManiaScript inserted verbatim. */
  raw(text: string): MsCode;
}

// Raw strings keep ManiaScript escapes like \" and \n as written.
function tag(strings: TemplateStringsArray, ...values: MsValue[]): MsCode {
  const parts = dedentParts(strings.raw);
  let text = parts[0]!;
  values.forEach((value, i) => {
    text += literal(value, `ms\`\` interpolation ${i}`) + parts[i + 1]!;
  });
  return code(text);
}

export const ms: Ms = Object.assign(tag, {
  real: (n: number) => code(realText(n, "ms.real()")),
  int: (n: number) => code(intText(n, "ms.int()")),
  vec2: (x: number, y: number) =>
    code(`<${realText(x, "ms.vec2() x")}, ${realText(y, "ms.vec2() y")}>`),
  raw(text: string) {
    if (typeof text !== "string") throw new TypeError("ms.raw() expects a string");
    return code(text);
  },
});
