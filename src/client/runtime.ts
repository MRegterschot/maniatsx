import { ms } from "../ms.ts";
import { useRenderScope } from "../render.ts";
import { installClientExtension, type ClientHost } from "../manialink.tsx";
import type { Node } from "../vnode.ts";
import {
  CLIENT,
  type ClientBinding,
  type ClientFn,
  type ClientHandler,
  type ClientRef,
  type ClientShared,
  type ClientState,
  type ClientStateOptions,
  type CompiledCode,
  type CompiledRuntime,
  type MsType,
} from "./contract.ts";

export const CLIENT_SCOPE = Symbol.for("maniatsx.manialink");
export type { ClientHost } from "../manialink.tsx";
const literalText = (value: string) => ms`${value}`.code;
function typeName(type: MsType): string {
  if (typeof type === "string") return type;
  if ("array" in type) return `${typeName(type.array)}[]`;
  if ("record" in type) return `${typeName(type.record.value)}[${type.record.key}]`;
  return type.struct;
}
function emptyCollection(type: MsType, inner: boolean): string {
  if (inner)
    throw new TypeError(
      `An empty ${typeName(type)} cannot be written inside an array or record literal`,
    );
  return typeName(type);
}
const isEmptyCollection = (value: unknown, type: MsType) =>
  typeof type === "object" &&
  (("array" in type && Array.isArray(value) && value.length === 0) ||
    ("record" in type &&
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0));
// `inner` is true inside array/record literals, where the game's parser has no typed empty collection
function literal(value: unknown, type: MsType, inner = false): string {
  if (typeof type !== "string") {
    if ("struct" in type) {
      if (!type.fields) throw new Error("struct values are not supported yet");
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new TypeError(`Expected ${type.struct} value`);
      // Empty collections are the field default, and `field = Integer[]` is not valid in a struct literal
      const fields = type.fields
        .map((f) => [f, (value as Record<string, unknown>)[f.name]] as const)
        .filter(([f, v]) => !isEmptyCollection(v, f.type))
        .map(([f, v]) => `${f.name} = ${literal(v, f.type)}`);
      return fields.length ? `${type.struct} { ${fields.join(", ")} }` : `${type.struct} {}`;
    }
    if ("array" in type) {
      if (!Array.isArray(value)) throw new TypeError("Expected an array");
      if (!value.length) return emptyCollection(type, inner);
      return `[${value.map((v) => literal(v, type.array, true)).join(", ")}]`;
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TypeError("Expected a record");
    if (!Object.keys(value).length) return emptyCollection(type, inner);
    return `[${Object.entries(value)
      .map(
        ([k, v]) =>
          `${literal(type.record.key === "Integer" ? Number(k) : k, type.record.key)} => ${literal(v, type.record.value, true)}`,
      )
      .join(", ")}]`;
  }
  switch (type) {
    case "Integer":
      return ms.int(value as number).code;
    case "Real":
      return ms.real(value as number).code;
    case "Boolean":
      if (typeof value === "boolean") return value ? "True" : "False";
      break;
    case "Text":
      if (typeof value === "string") return literalText(value);
      break;
    case "Ident":
      throw new TypeError("Ident values are not supported yet");
    case "Vec2":
    case "Vec3":
    case "Int2":
    case "Int3": {
      if (!value || typeof value !== "object") break;
      const v = value as Record<string, number>;
      const component = type.startsWith("Int") ? ms.int : ms.real;
      return `<${["X", "Y", ...(type.endsWith("3") ? ["Z"] : [])].map((k) => component(v[k]!).code).join(", ")}>`;
    }
  }
  throw new TypeError(`Expected ${type} value`);
}
// FNV-1a, so persisted names depend only on the source site
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}
// Keys name `for This` variables shared across pages; the suffixes are taken by the version and last-seen variables
const SHARED_KEY = /^[A-Za-z]\w*$/;
const SHARED_SUFFIX = /_(V|Seen)$/;
export function checkSharedKey(key: string, site: string): void {
  if (!SHARED_KEY.test(key) || SHARED_SUFFIX.test(key))
    throw new Error(
      `client.shared at ${site}: invalid key ${JSON.stringify(key)}; use letters, digits and "_", starting with a letter and not ending in _V or _Seen`,
    );
}
interface SharedInfo {
  shared: ClientShared;
  name: string;
  read: boolean;
  published: boolean;
  // Functions run (in order) when the version changes
  watchers: string[];
}
// Matches the compiler's `Mtx_Dirty = True;` statements so they can be dropped on pages without bindings
const DIRTY_WRITE = /\bMtx_Dirty = True;/g;
export class ClientScope {
  private states = new Map<ClientState, string>();
  private persistedNames = new Set<string>();
  private stateCount = 0;
  // Persisted states read by the code being filled: each function body must re-bind them
  private used: Set<ClientState | ClientShared>[] = [];
  private shareds = new Map<string, SharedInfo>();
  private refs = new Map<ClientRef, string>();
  private attached = new Map<ClientRef, { tag: string; id: string }>();
  private functions = new Set<string>();
  private handlers = new Map<string, string>();
  private eventHandlers = new Map<string, string>();
  private elementCount = 0;
  private controlCount = 0;
  private dirty = false;
  constructor(private host: ClientHost) {}
  // Bindings are the only readers of the flag, so only they turn it on
  private ensureDirty() {
    if (!this.dirty) {
      this.dirty = true;
      this.host.part("globals", "declare Boolean Mtx_Dirty;");
    }
  }
  // Fills code that becomes a function body and returns the declarations that re-bind its persisted states
  private body(code: CompiledCode, indent = ""): { text: string; declares: string } {
    const used = new Set<ClientState | ClientShared>();
    this.used.push(used);
    try {
      const text = this.fill(code);
      const declares = [...used]
        .map((s) =>
          s.kind === "shared"
            ? `${indent}declare ${typeName(s.type)} ${this.shareds.get(s.key)!.name} for This;\n`
            : `${indent}declare ${typeName(s.type)} ${this.states.get(s)!} for Page;\n`,
        )
        .join("");
      return { text, declares };
    } finally {
      this.used.pop();
    }
  }
  fill(code: CompiledCode): string {
    if (code.code.length !== code.holes.length + 1)
      throw new Error(`Invalid compiled code at ${code.site}`);
    for (const struct of code.structs) this.host.part("structs", struct, struct);
    let result = code.code[0]!;
    code.holes.forEach((hole, i) => {
      let value: string;
      switch (hole.kind) {
        case "value":
          value = literal(hole.get(), hole.type);
          break;
        case "state":
          value = this.state(hole.get());
          break;
        case "shared":
          value = this.read(hole.get());
          break;
        case "ref":
          value = this.ref(hole.get());
          break;
        case "action":
          value = literalText(hole.get().name);
          break;
        case "fn":
          value = this.fn(hole.get());
          break;
        case "lib":
          value = this.host.lib(hole.lib);
          break;
      }
      result += value + code.code[i + 1]!;
    });
    return result.replace(DIRTY_WRITE, () => this.host.dirty());
  }
  state(state: ClientState): string {
    if (state.persist) this.used.at(-1)?.add(state);
    let name = this.states.get(state);
    if (name) return name;
    if (state.persist) return this.persisted(state);
    name = `Mtx_S${++this.stateCount}`;
    this.states.set(state, name);
    this.host.part("globals", `declare ${typeName(state.type)} ${name};`);
    this.host.part("stateInit", `${name} = ${this.fill(state.initial)};`, `state:${name}`);
    return name;
  }
  private sharedInfo(shared: ClientShared): SharedInfo {
    checkSharedKey(shared.key, shared.site);
    let info = this.shareds.get(shared.key);
    if (!info) {
      info = {
        shared,
        name: `Mtx_X_${shared.key}`,
        read: false,
        published: false,
        watchers: [],
      };
      this.shareds.set(shared.key, info);
    } else if (typeName(info.shared.type) !== typeName(shared.type))
      throw new Error(
        `client.shared key "${shared.key}" is declared with two types (${typeName(info.shared.type)} at ${info.shared.site}, ${typeName(shared.type)} at ${shared.site}); a key has one type`,
      );
    return info;
  }
  // Reading code (bindings, handlers, lifecycle, fns); function bodies re-declare it like persisted state
  read(shared: ClientShared): string {
    const info = this.sharedInfo(shared);
    info.read = true;
    this.used.at(-1)?.add(shared);
    return info.name;
  }
  watch(shared: ClientShared, code: CompiledCode) {
    const info = this.sharedInfo(shared);
    info.read = true;
    const { text, declares } = this.body(code);
    const body = declares + text;
    const name = this.handler(body);
    if (!info.watchers.includes(name)) info.watchers.push(name);
  }
  publish(shared: ClientShared, value: unknown) {
    const info = this.sharedInfo(shared);
    info.published = true;
    // Both statements run in main, where the `for This` declarations live
    this.host.part("main", `${info.name} = ${literal(value, shared.type)};\n${info.name}_V += 1;`);
  }
  // Deduped function for a handler or watcher body
  private handler(body: string): string {
    let name = this.handlers.get(body);
    if (!name) {
      name = `Mtx_H${this.handlers.size + 1}`;
      this.handlers.set(body, name);
      this.host.part("functions", `Void ${name}() {\n${body}\n}`);
    }
    return name;
  }
  // Deduped function for an on* handler body; it receives the event
  private eventHandler(body: string): string {
    let name = this.eventHandlers.get(body);
    if (!name) {
      name = `Mtx_E${this.eventHandlers.size + 1}`;
      this.eventHandlers.set(body, name);
      this.host.part("functions", `Void ${name}(CMlScriptEvent Event) {\n${body}\n}`);
    }
    return name;
  }
  // Declarations and version tracking, emitted once the page's bindings are known
  private finishShared() {
    for (const info of this.shareds.values()) {
      const type = typeName(info.shared.type);
      const tracked = info.read && (info.watchers.length > 0 || this.dirty);
      for (const struct of info.shared.initial.structs) this.host.part("structs", struct, struct);
      this.host.part(
        "stateInit",
        info.read
          ? `declare ${type} ${info.name} for This = ${this.fill(info.shared.initial)};`
          : `declare ${type} ${info.name} for This;`,
        `shared:${info.name}`,
      );
      if (!tracked && !info.published) continue;
      this.host.part("stateInit", `declare Integer ${info.name}_V for This;`);
      if (!tracked) continue;
      // The last-seen version starts at 0, so a version published before this page loaded runs once at init
      this.host.part("globals", `declare Integer ${info.name}_Seen;`);
      this.host.part(
        "sync",
        [
          `if (${info.name}_V != ${info.name}_Seen) {`,
          `  ${info.name}_Seen = ${info.name}_V;`,
          `  ${this.host.dirty()}`,
          ...info.watchers.map((w) => `  ${w}();`),
          "}",
        ].join("\n"),
      );
    }
  }
  // `declare … for Page = init;` in main applies init once; function bodies re-bind it without a value
  private persisted(state: ClientState): string {
    const { key, keyPrefix } = state.persist!;
    let name: string;
    if (key !== undefined) {
      if (!/^[A-Za-z]\w*$/.test(key))
        throw new Error(
          `client.state at ${state.site}: invalid persist key ${JSON.stringify(key)}`,
        );
      name = `Mtx_P_${keyPrefix ? `${keyPrefix}_${key}`.replace(/\W/g, "") : key}`;
      if (this.persistedNames.has(name))
        throw new Error(
          `client.state at ${state.site}: persist key "${key}" is used twice on this page; keys must be unique`,
        );
    } else {
      // The same site rendered twice (a component used twice) gets a numbered suffix
      const stem = state.site
        .replace(/:\d+:\d+$/, "")
        .split("/")
        .pop()!
        .replace(/\.\w+$/, "");
      const base = `Mtx_P_${keyPrefix ? `${keyPrefix}_`.replace(/\W/g, "") : ""}${stem.replace(/\W/g, "") || "state"}_${hash(state.site)}`;
      name = base;
      for (let n = 2; this.persistedNames.has(name); n++) name = `${base}_${n}`;
    }
    this.persistedNames.add(name);
    this.states.set(state, name);
    this.used.push(new Set());
    try {
      this.host.part(
        "stateInit",
        `declare ${typeName(state.type)} ${name} for Page = ${this.fill(state.initial)};`,
        `state:${name}`,
      );
    } finally {
      this.used.pop();
    }
    return name;
  }
  // Global of a ref used in client code; its init is emitted in finish(), once attachment is known
  ref(ref: ClientRef): string {
    let name = this.refs.get(ref);
    if (name) return name;
    if (!/^[A-Za-z]\w*$/.test(ref.cls)) throw new Error(`Invalid control class at ${ref.site}`);
    name = `Mtx_R${this.refs.size + 1}`;
    this.refs.set(ref, name);
    this.host.part("globals", `declare ${ref.cls} ${name};`);
    return name;
  }
  fn(fn: ClientFn): string {
    if (!this.functions.has(fn.name)) {
      this.functions.add(fn.name);
      const { text, declares } = this.body(fn.declaration, "  ");
      // The signature ends at the first `{`; the lowerer indents the body by two spaces
      const open = text.indexOf("{\n") + 2;
      this.host.part(
        "functions",
        declares && open > 1 ? text.slice(0, open) + declares + text.slice(open) : text,
        `fn:${fn.name}`,
      );
    }
    return fn.name;
  }
  lifecycle(slot: "main" | "loop", code: CompiledCode) {
    this.host.part(slot, this.fill(code));
  }
  element(tag: string, props: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(props).filter(
      (entry): entry is [string, { $$typeof: typeof CLIENT; kind: string }] => isClient(entry[1]),
    );
    if (!entries.length) return props;
    const out = { ...props };
    const id = out.id === undefined ? `mtx-${++this.elementCount}` : out.id;
    if (typeof id !== "string" || !id) throw new Error(`<${tag}> client props require a string id`);
    out.id = id;
    const events: Record<string, string> = {
      onClick: "MouseClick",
      onRightClick: "MouseRightClick",
      onMouseOver: "MouseOver",
      onMouseOut: "MouseOut",
      onSubmit: "EntrySubmit",
    };
    const bindings: Record<string, Record<string, string>> = {
      label: { text: "Value", hidden: "Visible", pos: "RelativePosition_V3", opacity: "Opacity" },
      quad: {
        hidden: "Visible",
        pos: "RelativePosition_V3",
        opacity: "Opacity",
        image: "ChangeImageUrl",
        bgcolor: "BgColor",
      },
      gauge: { hidden: "Visible", pos: "RelativePosition_V3", ratio: "Ratio" },
      entry: { hidden: "Visible", pos: "RelativePosition_V3", default: "Value" },
    };
    let control: string | undefined;
    for (const [attr, handle] of entries) {
      delete out[attr];
      if (handle.kind === "ref" && attr === "ref") {
        const ref = handle as ClientRef;
        const prior = this.attached.get(ref);
        if (prior)
          throw new Error(
            `client.ref declared at ${ref.site} is attached to two elements (<${prior.tag} id="${prior.id}"> and <${tag} id="${id}">); a ref points at one control`,
          );
        this.attached.set(ref, { tag, id });
      } else if (
        handle.kind === "handler" &&
        events[attr] &&
        (attr !== "onSubmit" || tag === "entry" || tag === "textedit")
      ) {
        out.scriptevents = true;
        const { text, declares } = this.body((handle as ClientHandler).body);
        const name = this.eventHandler(declares + text);
        this.host.part(
          "events",
          `if (Event.Type == CMlScriptEvent::Type::${events[attr]} && Event.ControlId == ${literalText(id)}) ${name}(Event);`,
        );
      } else if (handle.kind === "bind" && bindings[tag]?.[attr]) {
        this.ensureDirty();
        if (!control) {
          control = `Mtx_C${++this.controlCount}`;
          const cls = `CMl${tag[0]!.toUpperCase()}${tag.slice(1)}`;
          this.host.part(
            "main",
            `declare ${cls} ${control} <=> (Page.GetFirstChild(${literalText(id)}) as ${cls});`,
          );
        }
        const binding = handle as ClientBinding;
        let expr = this.fill(binding.expr);
        if (attr === "bgcolor" && binding.type === "Text") {
          expr = `${this.host.lib("ColorLib")}::HexToRgb(${expr})`;
        }
        const property = bindings[tag]![attr]!;
        const update =
          property === "ChangeImageUrl"
            ? `${control}.${property}(${expr});`
            : `${control}.${property} = ${attr === "hidden" ? `!(${expr})` : expr};`;
        this.host.part("main", update);
        this.host.part("loop", `if (Mtx_Dirty) { ${update} }`);
      } else throw new Error(`<${tag}> attribute "${attr}": unsupported client ${handle.kind}`);
    }
    return out;
  }
  finish() {
    for (const [ref, name] of this.refs) {
      const target = this.attached.get(ref);
      if (!target)
        throw new Error(
          `client.ref declared at ${ref.site} is used in client code but never attached to an element in this <Manialink>; add ref={...} to one`,
        );
      this.host.part(
        "refInit",
        `${name} <=> (Page.MainFrame.GetFirstChild(${literalText(target.id)}) as ${ref.cls});`,
      );
    }
    this.finishShared();
    this.host.dirtyWrites(this.dirty);
    if (this.dirty) {
      this.host.part("main", "Mtx_Dirty = True;");
      this.host.part("loop", "Mtx_Dirty = False;");
    }
  }
}
export function isClient(value: unknown): value is { $$typeof: typeof CLIENT; kind: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $$typeof?: symbol }).$$typeof === CLIENT
  );
}
function scope(): ClientScope {
  const found = useRenderScope<{ client: ClientScope }>(CLIENT_SCOPE)?.client;
  if (!found) throw new Error("Client handles can only be used inside <Manialink>");
  return found;
}
export interface PublishProps<T> {
  to: ClientShared<T>;
  value: T;
}
// Server side of client.shared: assigns the value and bumps the version in this page's script
export function Publish<T>(props: PublishProps<T>): Node {
  if (!isClient(props.to) || props.to.kind !== "shared")
    throw new Error("<Publish> `to` must be a client.shared handle");
  scope().publish(props.to, props.value);
  return null;
}

export const __mtx: CompiledRuntime = {
  shared: (key, type, initial, site) => ({
    $$typeof: CLIENT,
    kind: "shared",
    key,
    type,
    initial,
    site,
    value: undefined as never,
  }),
  watch: (shared, body) => scope().watch(shared, body),
  ref: (cls, site) => ({ $$typeof: CLIENT, kind: "ref", cls, site, control: undefined as never }),
  state: (type, initial, site, options?: ClientStateOptions) => ({
    $$typeof: CLIENT,
    kind: "state",
    type,
    initial,
    site,
    ...(options?.persist && {
      persist: {
        ...(options.key === undefined ? {} : { key: options.key }),
        ...(options.keyPrefix && { keyPrefix: options.keyPrefix }),
      },
    }),
    value: undefined as never,
  }),
  handler: (body) => ({ $$typeof: CLIENT, kind: "handler", body }),
  bind: (type, expr) => ({ $$typeof: CLIENT, kind: "bind", type, expr }),
  fn: (name, declaration) => ({ $$typeof: CLIENT, kind: "fn", name, declaration }),
  onInit: (body) => scope().lifecycle("main", body),
  onFrame: (body) => scope().lifecycle("loop", body),
};

// Importing maniatsx/client (as compiled code does) enables client handles in <Manialink>
installClientExtension((host) => new ClientScope(host));
