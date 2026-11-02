import { ClientScope } from "./client/runtime.ts";
import { dedent, ms } from "./ms.ts";
import { raw } from "./raw.ts";
import { renderChildren, useRenderScope } from "./render.ts";
import { jsx } from "./jsx-runtime.ts";
import type { ManialinkLayer } from "./intrinsics-overrides.ts";
import { MS_CODE, type MsCode, type Node } from "./vnode.ts";

const PROLOG = '<?xml version="1.0" encoding="utf-8" standalone="yes"?>';
const SCOPE_KEY = Symbol.for("maniatsx.manialink");
const LIB = /^[\w./-]+$/;
const ALIAS = /^[A-Za-z_]\w*$/;

type Slot = "structs" | "globals" | "functions" | "stateInit" | "main" | "events" | "loop";

/** Script source: a string, `ms` code, or arrays of those. Nullish and `false` are skipped. */
export type ScriptCode = string | MsCode | false | null | undefined | readonly ScriptCode[];

export interface ManialinkProps {
  /** Manialink id (the game's page id). */
  id: string;
  name?: string;
  /** Display layer; "ScoresTable" shows the page with the scoreboard. */
  layer?: ManialinkLayer;
  /** Emit the XML prolog. Default: true. */
  prolog?: boolean;
  children?: Node;
}

export interface ScriptPartProps {
  children?: ScriptCode;
  /** Dedupes the part within its slot (first wins). Named `id` because the runtime consumes `key`. */
  id?: string;
}

export interface ScriptIncludeProps {
  /** Library name or path, e.g. "TextLib". */
  lib: string;
  /** Alias used in the script, e.g. "TL". */
  as: string;
}

interface Part {
  id: string | undefined;
  code: string;
}

interface ScriptScope {
  client: ClientScope;
  includes: Map<string, string>;
  slots: Record<Slot, Part[]>;
  rawScript: boolean;
  onRawScript(): void;
}

function createScope(): ScriptScope {
  const scope: ScriptScope = {
    client: undefined as unknown as ClientScope,
    includes: new Map(),
    slots: {
      structs: [],
      globals: [],
      functions: [],
      stateInit: [],
      main: [],
      events: [],
      loop: [],
    },
    rawScript: false,
    onRawScript() {
      this.rawScript = true;
    },
  };
  scope.client = new ClientScope({
    part(slot, code, id) {
      const parts = scope.slots[slot];
      if (id !== undefined && parts.some((part) => part.id === id)) return;
      parts.push({ id, code });
    },
    include(lib, alias) {
      addInclude(scope, lib, alias);
    },
  });
  return scope;
}

function requireScope(name: string): ScriptScope {
  const scope = useRenderScope<ScriptScope>(SCOPE_KEY);
  if (!scope) throw new Error(`<${name}> can only be used inside <Manialink>`);
  return scope;
}

function flatten(src: ScriptCode, name: string, out: string[]): void {
  if (src === null || src === undefined || src === false) return;
  if (typeof src === "string") out.push(dedent(src));
  else if (Array.isArray(src)) for (const item of src) flatten(item, name, out);
  else if ((src as MsCode).$$typeof === MS_CODE) out.push((src as MsCode).code);
  else throw new Error(`<${name}> children must be strings or ms code, got ${typeof src}`);
}

function trimBlankEdges(text: string): string {
  return text.replace(/^([ \t]*\n)+/, "").replace(/(\n[ \t]*)+$/, "");
}

function makePart(slot: Slot, name: string) {
  return function ScriptPart(props: ScriptPartProps): Node {
    const scope = requireScope(name);
    if (props.id !== undefined && typeof props.id !== "string") {
      throw new Error(`<${name}> id must be a string`);
    }
    const pieces: string[] = [];
    flatten(props.children, name, pieces);
    const code = trimBlankEdges(pieces.join("\n"));
    if (code.trim() === "") return null;
    const parts = scope.slots[slot];
    if (props.id !== undefined && parts.some((p) => p.id === props.id)) return null;
    parts.push({ id: props.id, code });
    return null;
  };
}

function Include(props: ScriptIncludeProps): Node {
  addInclude(requireScope("Script.Include"), props.lib, props.as);
  return null;
}

function addInclude(scope: ScriptScope, lib: string, alias: string): void {
  if (typeof lib !== "string" || !LIB.test(lib)) {
    throw new Error(`<Script.Include> invalid lib ${JSON.stringify(lib)}`);
  }
  if (typeof alias !== "string" || !ALIAS.test(alias)) {
    throw new Error(`<Script.Include lib="${lib}"> invalid alias ${JSON.stringify(alias)}`);
  }
  const existing = scope.includes.get(lib);
  if (existing !== undefined) {
    if (existing !== alias) {
      throw new Error(
        `<Script.Include> lib "${lib}" is already included as "${existing}", not "${alias}"`,
      );
    }
    return;
  }
  for (const [otherLib, otherAlias] of scope.includes) {
    if (otherAlias === alias) {
      throw new Error(
        `<Script.Include> alias "${alias}" is already used for lib "${otherLib}", not "${lib}"`,
      );
    }
  }
  scope.includes.set(lib, alias);
}

/** Script parts register into the nearest `<Manialink>`; they render no XML. */
export const Script = {
  Include,
  Globals: makePart("globals", "Script.Globals"),
  Functions: makePart("functions", "Script.Functions"),
  Main: makePart("main", "Script.Main"),
  Events: makePart("events", "Script.Events"),
  Loop: makePart("loop", "Script.Loop"),
};

function indentBlock(parts: Part[], spaces: number): string[] {
  const pad = " ".repeat(spaces);
  return parts.flatMap((p) =>
    p.code.split("\n").map((line) => (line.trim() === "" ? "" : pad + line)),
  );
}

function assemble(scope: ScriptScope, manialinkId: string): string | null {
  const { structs, globals, functions, stateInit, main, events, loop } = scope.slots;
  const count =
    scope.includes.size +
    structs.length +
    globals.length +
    functions.length +
    stateInit.length +
    main.length +
    events.length +
    loop.length;
  if (count === 0) return null;
  if (scope.rawScript) {
    throw new Error(
      `<Manialink id="${manialinkId}"> mixes Script.* parts with a raw <script>; a page has one script`,
    );
  }
  const lines: string[] = [];
  for (const [lib, alias] of scope.includes) lines.push(`#Include "${lib}" as ${alias}`);
  lines.push(...indentBlock(structs, 0), ...indentBlock(globals, 0), ...indentBlock(functions, 0));
  lines.push(
    "main() {",
    ...indentBlock(stateInit, 2),
    ...indentBlock(main, 2),
    "  while (True) {",
    "    yield;",
  );
  if (events.length > 0) {
    lines.push("    foreach (Event in PendingEvents) {", ...indentBlock(events, 6), "    }");
  }
  lines.push(...indentBlock(loop, 4), "  }", "}");
  return lines.join("\n");
}

function ManialinkBody(props: { manialinkId: string; children?: Node }): Node {
  const scope = createScope();
  const xml = renderChildren(props.children, { key: SCOPE_KEY, value: scope });
  scope.client.finish();
  const script = assemble(scope, props.manialinkId);
  return [raw(xml), script === null ? null : jsx("script", { children: ms.raw(script) })];
}

export function Manialink(props: ManialinkProps): Node {
  if (useRenderScope(SCOPE_KEY))
    throw new Error("<Manialink> cannot be nested inside another <Manialink>");
  if (typeof props.id !== "string" || props.id === "")
    throw new Error("<Manialink> requires an id");
  // jsx() directly so props pass through without re-spreading
  const element = jsx("manialink", {
    id: props.id,
    name: props.name,
    version: 3,
    layer: props.layer,
    children: jsx(ManialinkBody, { manialinkId: props.id, children: props.children }),
  });
  return [props.prolog === false ? null : raw(PROLOG), element];
}
