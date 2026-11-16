# maniatsx theming

## Goal

Let an app ship preset themes that change anything in a manialink (colors, fonts, sizes, positions, text, even the markup of one widget) without widget authors writing one template per theme. gocontrolpanel will use this for its server presets after M6.

## Model

A theme has three layers. Most themes only need the first.

| Layer | Changes | API |
|---|---|---|
| Tokens, text, layout | colors, fonts, sizes, strings, widget anchor/margin/scale/visibility | `defineTheme({ tokens, text, layout })`, `useTokens()`, `useText()`, `<Anchored>` |
| Primitives | how shared building blocks (panel, header, button, table) look | `slot()` components overridden by `theme.components` |
| Skins | a full alternative view for one widget | the same `slot()`, with variants shipped by the widget itself |

Widget logic and its view are split: the logic component creates client state, handlers, bindings and refs, and passes them as typed props to a view slot. A skin is another implementation of that props type, so the "contract" a skin must keep is checked by TypeScript, and render fails if a ref used by client code was never placed.

## T1. Theme kit (`maniatsx/theme`, `src/theme.ts`)

```ts
const kit = createThemeKit<Tokens>({ id: "default", name: "Default", tokens: { ... }, text: { ... } });

const midnight = kit.defineTheme({
  id: "midnight",
  name: "Midnight",
  extends: kit.base,              // any theme from this kit; defaults to kit.base
  tokens: { color: { surface: "111" } },        // DeepPartial<Tokens>
  text: { "table.prev": " Prev" },
  layout: { "map-info": { anchor: "top-left", margin: [2, 2] } },
  components: [override(Panel, GlassPanel)],
});

<kit.ThemeProvider theme={midnight}>…</kit.ThemeProvider>
kit.useTokens(): Tokens           // fully merged
kit.useText(key, fallback): string
kit.useTheme(): Theme<Tokens>     // id, name, chain
```

- `defineTheme` resolves eagerly: tokens are deep-merged over the parent (plain objects merge, arrays and primitives replace), `text` and `layout` merge per key (a layout entry merges field by field over the parent's entry), `components` are inherited with child entries winning. The result is frozen.
- `Theme` keeps `chain: readonly string[]` (own id first, then ancestors) for slot variant lookup.
- Ids must be unique per kit; `defineTheme` throws on a duplicate. `kit.themes()` lists them in definition order (for pickers).
- Outside a provider the hooks return the base theme.

## T2. Slots

```ts
const Panel = slot<PanelProps>("ui/panel", DefaultPanel, { compact: CompactPanel });
override(Panel, (props) => <props.Default {...props} size={...} />)
```

- `slot(name, Default, variants?)` returns a component. At render it picks, in order: the active theme's `components` entry for this slot, then `variants[id]` for each id in the theme's `chain`, then `Default`.
- An override receives the slot props plus `Default`, so it can wrap instead of replace.
- `override(slot, impl)` returns a typed entry; `components` is an array of those (no global string registry, so third-party widgets can define slots and themes can still target them).
- Slot names must be unique; creating two slots with one name throws.
- Slots are kit-independent: they read whatever theme the nearest provider of any kit set (one shared internal context holding `{ chain, components }`).

## T3. Layout

```ts
type Anchor = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
interface Layout { anchor: Anchor; margin?: Vec2; size: Vec2; scale?: number; hidden?: boolean }

anchorPos(layout): [x, y]                          // pure
useLayout(key, defaults): Required<Layout> & { pos: [x, y] }
<Anchored name="map-info" layout={defaults} id? z-index?>{children}</Anchored>   // <frame pos scale hidden>
```

- Screen is 320×180, origin at the center, y up; a frame's `pos` is its top-left corner.
- `margin` is the distance inward from the anchored edges. On a centered axis it is a signed shift (x right, y up).
- `size` is the unscaled content size; the anchor math uses `size * scale`.
- Examples: `top-right` → `x = 160 - w*s - mx`, `y = 90 - my`; `bottom-left` → `x = -160 + mx`, `y = -90 + h*s + my`; `center` → `x = -w*s/2 + mx`, `y = h*s/2 + my`.
- Results are rounded to 3 decimals so no float noise reaches the XML.
- `<Anchored>` emits `scale` only when it isn't 1 and `hidden` only when true.

## T4. Client refs (`maniatsx/client`)

```ts
const name = client.ref<CMlLabel>();
<label ref={name} />                      // in any component, including a skin
client.onInit(() => { name.control.Value = "x"; });
```

- `ref` is allowed on every intrinsic element; the runtime takes the element's `id` or assigns `mtx-<n>`.
- The runtime emits `declare CMlLabel Mtx_R<n>;` in globals and `Mtx_R<n> <=> (Page.MainFrame.GetFirstChild("<id>") as CMlLabel);` at the start of main, before any `onInit` or binding init.
- `ref.control` in client code compiles to `Mtx_R<n>`. The class name comes from the type argument (the compiler rejects a ref without one).
- Render throws, naming the ref's source site, when client code uses a ref that no element in the same manialink attached, or when two elements attach the same ref.
- A ref that is attached but never used costs nothing (no global).

## T5. Client values across components

Handlers, bindings, refs and state made in one component and placed on elements by another (a skin) must work. Covered by tests; no new API.

## Milestones

| # | Work | Owner |
|---|---|---|
| T1–T3 | `src/theme.ts`, `maniatsx/theme` export, unit + type tests | Codex |
| T4–T5 | `client.ref`, compiler + runtime, tests incl. a view slot receiving client props | Sonnet |
| T6 | Example: themed widget (logic + view slot) with default, midnight and compact presets; golden per preset | Codex |
| T7 | P2-6: port the gocontrolpanel action group toggle to client TS | Sonnet |
| T8 | README theming section | Codex |
| T9 | In-game check of T6 and P2-7 goldens | user + lead |

## Out of scope

- Runtime theme switching on the client (themes are applied at render; switching means re-sending pages).
- Theme persistence, pickers and gocontrolpanel wiring (M6).
- Responsive layouts for non-16:9 screens.
