// Attribute value serialisation. Throws on anything that would produce invalid XML.

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`Cannot serialise non-finite number ${n}`);
  // toFixed switches to exponent notation from 1e21; integers there are exact in BigInt.
  if (Math.abs(n) >= 1e21) return BigInt(n).toString();
  let s = n.toFixed(4);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

const ATTR_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "\n": "&#10;",
  "\r": "&#13;",
  "\t": "&#9;",
};

export function escapeAttribute(s: string): string {
  return s.replace(/[&<>"'\n\r\t]/g, (c) => ATTR_ESCAPES[c]!);
}

export function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ATTR_ESCAPES[c]!);
}

function num(n: number, element: string, name: string): string {
  if (!Number.isFinite(n)) {
    throw new RangeError(`<${element}> attribute "${name}": non-finite number ${n}`);
  }
  return formatNumber(n);
}

// Returns the unescaped attribute text, or null when the attribute is omitted.
export function serializeValue(element: string, name: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return num(value, element, name);
    case "boolean":
      return value ? "1" : "0";
  }
  if (Array.isArray(value)) {
    if (name === "class") {
      const parts: string[] = [];
      for (const part of value) {
        if (part === null || part === undefined || part === false) continue;
        if (typeof part !== "string") {
          throw new TypeError(`<${element}> attribute "class": array items must be strings`);
        }
        if (part !== "") parts.push(part);
      }
      return parts.length > 0 ? parts.join(" ") : null;
    }
    if (value.length > 0 && value.every((v) => typeof v === "number")) {
      return value.map((v: number) => num(v, element, name)).join(" ");
    }
  }
  throw new TypeError(
    `<${element}> attribute "${name}": unsupported value of type ${describeType(value)}`,
  );
}

function describeType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  return typeof value;
}
