import { contextRuntime, providers, type Context, type ContextEntry } from "./context.ts";
import { escapeAttribute, escapeText, formatNumber, serializeValue } from "./serialize.ts";
import { Fragment, MS_CODE, RAW_XML, VNODE, type Node, type VNode } from "./vnode.ts";

export interface RenderOptions {
  /** Indent with two spaces, one element per line. Default: compact. */
  pretty?: boolean;
  /** Context values available to the whole tree. */
  contexts?: Array<[Context<any>, unknown]>;
  /** Receives soft problems; defaults to console.warn. */
  onWarning?: (message: string) => void;
  /** Warn when the output exceeds this many bytes. */
  warnBytes?: number;
}

interface Scope {
  readonly key: symbol;
  readonly value: unknown;
}

interface State {
  out: string[];
  pretty: boolean;
  depth: number;
  element: string | null;
  contexts: ContextEntry[];
  scopes: Scope[];
  ids: Set<string>;
  warn: (message: string) => void;
}

const NAME = /^[A-Za-z_][\w.:-]*$/;
const STYLE_TEXT = new Set(["style", "stylesheet"]);

let current: State | null = null;

export function render(node: Node, options: RenderOptions = {}): string {
  const st: State = {
    out: [],
    pretty: options.pretty ?? false,
    depth: 0,
    element: null,
    contexts: (options.contexts ?? []).map(([ctx, value]) => ({ id: ctx.id, value })),
    scopes: [],
    ids: new Set(),
    warn: options.onWarning ?? ((m) => console.warn(m)),
  };
  const prev = current;
  const prevStack = contextRuntime.stack;
  current = st;
  contextRuntime.stack = st.contexts;
  try {
    walk(node, st);
  } finally {
    current = prev;
    contextRuntime.stack = prevStack;
  }
  let xml = st.out.join("");
  if (st.pretty && xml.endsWith("\n")) xml = xml.slice(0, -1);
  if (options.warnBytes !== undefined && xml.length * 3 > options.warnBytes) {
    const bytes = new TextEncoder().encode(xml).length;
    if (bytes > options.warnBytes) {
      st.warn(`Output is ${bytes} bytes, over the warnBytes limit of ${options.warnBytes}`);
    }
  }
  return xml;
}

// M3 hook: render children to a string at the current depth; a scope also gets its own id set.
export function renderChildren(node: Node, scope?: { key: symbol; value: unknown }): string {
  const st = requireState("renderChildren()");
  const saved = {
    out: st.out,
    ids: st.ids,
    depth: st.depth,
    element: st.element,
    contexts: st.contexts.length,
    scopes: st.scopes.length,
  };
  st.out = [];
  if (scope) {
    st.scopes.push(scope);
    st.ids = new Set();
  }
  try {
    walk(node, st);
    return st.out.join("");
  } finally {
    st.out = saved.out;
    st.ids = saved.ids;
    st.depth = saved.depth;
    st.element = saved.element;
    st.contexts.length = saved.contexts;
    st.scopes.length = saved.scopes;
  }
}

// M3 hook: the value of the nearest enclosing scope opened with this key.
export function useRenderScope<T>(key: symbol): T | undefined {
  const st = requireState("useRenderScope()");
  for (let i = st.scopes.length - 1; i >= 0; i--) {
    if (st.scopes[i]!.key === key) return st.scopes[i]!.value as T;
  }
  return undefined;
}

function requireState(fn: string): State {
  if (!current) throw new Error(`${fn} can only be called while rendering`);
  return current;
}

function describe(node: unknown): string {
  if (typeof node === "object" && node !== null && (node as VNode).$$typeof === VNODE) {
    const type = (node as VNode).type;
    if (typeof type === "string") return `<${type}>`;
    if (typeof type === "function") return `component ${type.name || "(anonymous)"}`;
    return "<Fragment>";
  }
  return typeof node;
}

function where(st: State): string {
  return st.element ? `inside <${st.element}>` : "at the top level";
}

function push(st: State, text: string): void {
  if (text !== "") st.out.push(text);
}

function pushText(st: State, text: string): void {
  if (st.pretty) push(st, "  ".repeat(st.depth) + text + "\n");
  else push(st, text);
}

function walk(node: Node, st: State): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") {
    const text = typeof node === "number" ? formatNumber(node) : node;
    if (st.element !== null && STYLE_TEXT.has(st.element)) {
      pushText(st, escapeText(text));
      return;
    }
    const preview = JSON.stringify(text.length > 30 ? text.slice(0, 30) + "..." : text);
    throw new Error(
      `Text ${preview} is not allowed ${where(st)}; only <script>, <style> and <stylesheet> take text`,
    );
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, st);
    return;
  }
  const obj = node as { $$typeof?: symbol };
  if (obj.$$typeof === RAW_XML) {
    const xml = (obj as { xml: string }).xml;
    push(st, st.pretty && xml !== "" && !xml.endsWith("\n") ? xml + "\n" : xml);
    return;
  }
  if (obj.$$typeof === MS_CODE) {
    throw new Error(`ManiaScript code is only allowed inside <script>, found ${where(st)}`);
  }
  if (obj.$$typeof !== VNODE) {
    throw new Error(`Cannot render a value of type ${typeof node} ${where(st)}`);
  }
  const vnode = node as VNode;
  const { type, props } = vnode;
  if (type === Fragment) {
    walk(props.children as Node, st);
  } else if (typeof type === "function") {
    const ctx = providers.get(type);
    if (ctx) {
      st.contexts.push({ id: ctx.id, value: props.value });
      try {
        walk(props.children as Node, st);
      } finally {
        st.contexts.pop();
      }
    } else {
      walk(type(props), st);
    }
  } else if (typeof type === "string") {
    writeElement(type, props, st);
  } else {
    throw new Error(`Invalid element type ${String(type)} ${where(st)}`);
  }
}

function writeAttributes(tag: string, props: VNode["props"], st: State): string {
  let attrs = "";
  for (const name of Object.keys(props)) {
    if (name === "children" || name === "key") continue;
    const value = props[name];
    if (Array.isArray(value) && value.length === 0 && name !== "class") {
      st.warn(`<${tag}> attribute "${name}" is an empty array and was omitted`);
      continue;
    }
    const text = serializeValue(tag, name, value);
    if (text === null) continue;
    if (!NAME.test(name)) throw new Error(`<${tag}>: invalid attribute name "${name}"`);
    if (name === "id") {
      if (st.ids.has(text)) st.warn(`Duplicate id "${text}" on <${tag}>`);
      else st.ids.add(text);
    }
    attrs += ` ${name}="${escapeAttribute(text)}"`;
  }
  return attrs;
}

function collectScriptText(node: Node, out: string[]): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string") out.push(node);
  else if (typeof node === "number") out.push(formatNumber(node));
  else if (Array.isArray(node)) for (const child of node) collectScriptText(child, out);
  else if ((node as { $$typeof?: symbol }).$$typeof === MS_CODE) {
    out.push((node as unknown as { code: string }).code);
  } else {
    throw new Error(`<script> only takes text or ManiaScript code, found ${describe(node)}`);
  }
}

function writeElement(tag: string, props: VNode["props"], st: State): void {
  if (!NAME.test(tag)) throw new Error(`Invalid element name "${tag}"`);
  const indent = st.pretty ? "  ".repeat(st.depth) : "";
  const nl = st.pretty ? "\n" : "";
  const open = `<${tag}${writeAttributes(tag, props, st)}`;

  if (tag === "script") {
    const parts: string[] = [];
    collectScriptText(props.children as Node, parts);
    const code = parts.join("");
    if (code.includes("-->")) throw new Error(`<script> content must not contain "-->"`);
    push(
      st,
      code === ""
        ? `${indent}${open} />${nl}`
        : `${indent}${open}><!--\n${code}\n--></script>${nl}`,
    );
    return;
  }

  const slot = st.out.length;
  st.out.push("");
  const prevElement = st.element;
  st.element = tag;
  st.depth++;
  try {
    walk(props.children as Node, st);
  } finally {
    st.depth--;
    st.element = prevElement;
  }
  if (st.out.length === slot + 1) {
    st.out[slot] = `${indent}${open} />${nl}`;
  } else {
    st.out[slot] = `${indent}${open}>${nl}`;
    st.out.push(`${indent}</${tag}>${nl}`);
  }
}
