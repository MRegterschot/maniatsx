import { createContext, useContext } from "./context.ts";
import type { Component, Node, Vec2 } from "./vnode.ts";
import { jsx } from "./jsx-runtime.ts";

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface Layout {
  anchor: Anchor;
  margin?: Vec2;
  size: Vec2;
  scale?: number;
  hidden?: boolean;
}

export interface Theme<Tokens = unknown> {
  readonly id: string;
  readonly name: string;
  readonly chain: readonly string[];
  readonly tokens: Tokens;
  readonly text: Readonly<Record<string, string>>;
  readonly layout: Readonly<Record<string, Readonly<Partial<Layout>>>>;
  readonly components: readonly OverrideEntry<any>[];
}

export interface ThemeData<Tokens> {
  id: string;
  name: string;
  chain: readonly string[];
  tokens: Tokens;
  text: Record<string, string>;
  layout: Record<string, Partial<Layout>>;
}

export interface ThemeDefinition<Tokens> {
  id: string;
  name: string;
  extends?: Theme<Tokens>;
  tokens?: DeepPartial<Tokens>;
  text?: Readonly<Record<string, string>>;
  layout?: Readonly<Record<string, Partial<Layout>>>;
  components?: readonly OverrideEntry<any>[];
}

export interface SlotComponent<P> extends Component<P> {
  readonly slotName: string;
  readonly slotId: symbol;
  readonly Default: Component<P>;
  readonly variants: Readonly<Record<string, Component<P>>>;
}

export interface OverrideEntry<P> {
  readonly slotId: symbol;
  readonly component: Component<P & { Default: Component<P> }>;
}

interface SlotTheme {
  chain: readonly string[];
  components: readonly OverrideEntry<any>[];
  layout: Readonly<Record<string, Readonly<Partial<Layout>>>>;
}
const slotContext = createContext<SlotTheme | null>(null);
const namedSlots = new Set<string>();

function cloneMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (Array.isArray(patch)) return patch.map((value) => cloneValue(value)) as T;
  if (Array.isArray(base) || !isRecord(base) || !isRecord(patch)) {
    return cloneValue(patch) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    result[key] =
      key in base ? cloneMerge(base[key as keyof T], value as never) : cloneValue(value);
  }
  return result as T;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    ) as T;
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freeze<T>(value: T): T {
  if (isRecord(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function mergeKeyed<T>(
  base: Readonly<Record<string, T>>,
  patch?: Readonly<Record<string, T>>,
): Record<string, T> {
  return { ...base, ...patch };
}

function mergeLayout(
  base: Readonly<Record<string, Readonly<Partial<Layout>>>>,
  patch?: Readonly<Record<string, Partial<Layout>>>,
): Record<string, Partial<Layout>> {
  const result: Record<string, Partial<Layout>> = { ...base };
  for (const [key, value] of Object.entries(patch ?? {}))
    result[key] = { ...result[key], ...value };
  return result;
}

function mergeComponents(
  parent: readonly OverrideEntry<any>[],
  child: readonly OverrideEntry<any>[] = [],
): OverrideEntry<any>[] {
  const result = new Map(parent.map((entry) => [entry.slotId, entry]));
  for (const entry of child) result.set(entry.slotId, entry);
  return [...result.values()];
}

export function override<P>(
  slot: SlotComponent<P>,
  component: Component<P & { Default: Component<P> }>,
): OverrideEntry<P> {
  return Object.freeze({ slotId: slot.slotId, component });
}

export function slot<P>(
  name: string,
  Default: Component<P>,
  variants: Readonly<Record<string, Component<P>>> = {},
): SlotComponent<P> {
  if (namedSlots.has(name)) throw new Error(`Duplicate theme slot name "${name}"`);
  namedSlots.add(name);
  const slotId = Symbol(name);
  const Slot: SlotComponent<P> = Object.assign(
    (props: P) => {
      const active = useContext(slotContext);
      // Theme override first, then a variant the slot ships for the theme or an ancestor
      const custom = active?.components.find((entry) => entry.slotId === slotId);
      if (custom) return custom.component({ ...props, Default });
      const variant = active?.chain.map((id) => variants[id]).find((value) => value !== undefined);
      return (variant ?? Default)(props);
    },
    { slotName: name, slotId, Default, variants },
  );
  return Slot;
}

export interface ThemeKit<Tokens> {
  readonly base: Theme<Tokens>;
  defineTheme(definition: ThemeDefinition<Tokens>): Theme<Tokens>;
  toData(theme: Theme<Tokens>): ThemeData<Tokens>;
  themes(): readonly Theme<Tokens>[];
  useTokens(): Tokens;
  useText(key: string, fallback?: string): string;
  useTheme(): Theme<Tokens>;
  ThemeProvider: Component<{ theme: Theme<Tokens> | ThemeData<Tokens>; children?: Node }>;
}

export function createThemeKit<Tokens>(definition: ThemeDefinition<Tokens>): ThemeKit<Tokens> {
  const themes = new Map<string, Theme<Tokens>>();
  const make = (def: ThemeDefinition<Tokens>, parent?: Theme<Tokens>): Theme<Tokens> => {
    if (themes.has(def.id)) throw new Error(`Duplicate theme id "${def.id}"`);
    if (def.extends && themes.get(def.extends.id) !== def.extends) {
      throw new Error(`Theme "${def.id}" extends a theme from another kit`);
    }
    const actualParent = def.extends ?? parent;
    const theme = freeze({
      id: def.id,
      name: def.name,
      chain: Object.freeze([def.id, ...(actualParent?.chain ?? [])]),
      tokens: cloneMerge(
        actualParent?.tokens ?? (def.tokens as Tokens),
        def.tokens ?? ({} as DeepPartial<Tokens>),
      ),
      text: mergeKeyed(actualParent?.text ?? {}, def.text),
      layout: mergeLayout(actualParent?.layout ?? {}, def.layout),
      components: mergeComponents(actualParent?.components ?? [], def.components),
    }) as Theme<Tokens>;
    themes.set(def.id, theme);
    return theme;
  };
  const base = make(definition);
  const themeContext = createContext(base);
  const wrappedProvider: ThemeKit<Tokens>["ThemeProvider"] = ({ theme, children }) => {
    const isData = !("components" in theme);
    if (
      isData &&
      (typeof theme.id !== "string" || !Array.isArray(theme.chain) || theme.chain[0] !== theme.id)
    )
      throw new Error("Invalid ThemeData: expected a string id and a chain starting with that id.");
    const components = isData ? [] : theme.components;
    return jsx(themeContext.Provider, {
      value: theme as Theme<Tokens>,
      children: jsx(slotContext.Provider, {
        value: { chain: theme.chain, components, layout: theme.layout },
        children,
      }),
    });
  };
  return {
    base,
    toData: (theme) =>
      structuredClone({
        id: theme.id,
        name: theme.name,
        chain: theme.chain,
        tokens: theme.tokens,
        text: theme.text,
        layout: theme.layout,
      }),
    defineTheme: (def) => make(def, def.extends ?? base),
    themes: () => Object.freeze([...themes.values()]),
    useTokens: () => useContext(themeContext).tokens,
    useText: (key, fallback = key) => useContext(themeContext).text[key] ?? fallback,
    useTheme: () => useContext(themeContext),
    ThemeProvider: wrappedProvider,
  };
}

export function anchorPos(layout: Layout): [number, number] {
  const [w, h] = layout.size;
  const [mx, my] = layout.margin ?? [0, 0];
  const scale = layout.scale ?? 1;
  const left = layout.anchor.endsWith("left");
  const right = layout.anchor.endsWith("right");
  const top = layout.anchor.startsWith("top");
  const bottom = layout.anchor.startsWith("bottom");
  const x = left ? -160 + mx : right ? 160 - w * scale - mx : (-w * scale) / 2 + mx;
  const y = top ? 90 - my : bottom ? -90 + h * scale + my : (h * scale) / 2 + my;
  return [round3(x), round3(y)];
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function useLayout(
  key: string,
  defaults: Layout,
): Required<Layout> & { pos: [number, number] } {
  const theme = useContext(slotContext);
  const layout = {
    ...defaults,
    ...(theme?.layout[key] ?? {}),
    margin: theme?.layout[key]?.margin ?? defaults.margin ?? [0, 0],
    scale: theme?.layout[key]?.scale ?? defaults.scale ?? 1,
    hidden: theme?.layout[key]?.hidden ?? defaults.hidden ?? false,
  } as Required<Layout>;
  return { ...layout, pos: anchorPos(layout) };
}

export interface AnchoredProps {
  name: string;
  layout: Layout;
  id?: string;
  "z-index"?: number;
  children?: Node;
}

export function Anchored({ name, layout, id, "z-index": zIndex, children }: AnchoredProps): Node {
  const { pos, scale, hidden } = useLayout(name, layout);
  return jsx("frame", {
    id,
    pos,
    scale: scale === 1 ? undefined : scale,
    hidden: hidden || undefined,
    "z-index": zIndex,
    children,
  });
}
