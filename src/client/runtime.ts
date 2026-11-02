import { ms } from "../ms.ts";
import { useRenderScope } from "../render.ts";
import { installClientExtension, type ClientHost } from "../manialink.tsx";
import {
  CLIENT,
  type ClientBinding,
  type ClientFn,
  type ClientHandler,
  type ClientState,
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
function literal(value: unknown, type: MsType): string {
  if (typeof type !== "string") {
    if ("struct" in type) throw new Error("struct values are not supported yet");
    if ("array" in type) {
      if (!Array.isArray(value) || !value.length) throw new TypeError("Expected a non-empty array");
      return `[${value.map((v) => literal(v, type.array)).join(", ")}]`;
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length)
      throw new TypeError("Expected a non-empty record");
    return `[${Object.entries(value)
      .map(
        ([k, v]) =>
          `${literal(type.record.key === "Integer" ? Number(k) : k, type.record.key)} => ${literal(v, type.record.value)}`,
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
export class ClientScope {
  private states = new Map<ClientState, string>();
  private functions = new Set<string>();
  private handlers = new Map<string, string>();
  private elementCount = 0;
  private controlCount = 0;
  private dirty = false;
  constructor(private host: ClientHost) {}
  private ensureDirty() {
    if (!this.dirty) {
      this.dirty = true;
      this.host.part("globals", "declare Boolean Mtx_Dirty;");
    }
  }
  fill(code: CompiledCode): string {
    if (code.code.length !== code.holes.length + 1)
      throw new Error(`Invalid compiled code at ${code.site}`);
    for (const [lib, alias] of code.includes) this.host.include(lib, alias);
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
        case "action":
          value = literalText(hole.get().name);
          break;
        case "fn":
          value = this.fn(hole.get());
          break;
      }
      result += value + code.code[i + 1]!;
    });
    return result;
  }
  state(state: ClientState): string {
    let name = this.states.get(state);
    if (name) return name;
    name = `Mtx_S${this.states.size + 1}`;
    this.states.set(state, name);
    this.ensureDirty();
    this.host.part("globals", `declare ${typeName(state.type)} ${name};`);
    this.host.part("stateInit", `${name} = ${this.fill(state.initial)};`, `state:${name}`);
    return name;
  }
  fn(fn: ClientFn): string {
    if (!this.functions.has(fn.name)) {
      this.functions.add(fn.name);
      this.host.part("functions", this.fill(fn.declaration), `fn:${fn.name}`);
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
      if (
        handle.kind === "handler" &&
        events[attr] &&
        (attr !== "onSubmit" || tag === "entry" || tag === "textedit")
      ) {
        out.scriptevents = true;
        const body = this.fill((handle as ClientHandler).body);
        let name = this.handlers.get(body);
        if (!name) {
          name = `Mtx_H${this.handlers.size + 1}`;
          this.handlers.set(body, name);
          this.host.part("functions", `Void ${name}() {\n${body}\n}`);
        }
        this.host.part(
          "events",
          `if (Event.Type == CMlScriptEvent::Type::${events[attr]} && Event.ControlId == ${literalText(id)}) ${name}();`,
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
          this.host.include("ColorLib", "ColorLib");
          expr = `ColorLib::HexToRgb(${expr})`;
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
export const __mtx: CompiledRuntime = {
  state: (type, initial, site) => ({
    $$typeof: CLIENT,
    kind: "state",
    type,
    initial,
    site,
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
