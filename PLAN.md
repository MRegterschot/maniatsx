# maniatsx: implementation plan

## Goal

Write Trackmania manialinks in TSX with full type checking, and render them to Manialink v3 XML at runtime.

Phase 1 (this plan) is a **JSX → XML renderer**: a custom `jsxImportSource`, typed intrinsic elements, function components, context, and a typed way to compose and embed ManiaScript. All logic runs on the server; ManiaScript is still written by hand, but assembled and parameterised safely.

Phase 2 (later, out of scope here) compiles a TypeScript subset to ManiaScript (client state, event handlers, server actions). Phase 1 must not paint us into a corner: render to a tree first, string last.

## Target usage

```tsx
// tsconfig: "jsx": "react-jsx", "jsxImportSource": "maniatsx"
import { Manialink, Script, createContext, ms, render, useContext } from "maniatsx";

const Theme = createContext({ bg: "111111cc", fg: "ffffff" });

function Window(props: { title: string; width: number; height: number; children?: unknown }) {
  const theme = useContext(Theme);
  return (
    <frame pos={[-props.width / 2, props.height / 2]} size={[props.width, props.height + 5]} z-index={20}>
      <quad size={[props.width, 5]} bgcolor={theme.bg} />
      <label pos={[1.5, -2.25]} text={props.title} textfont="GameFontSemiBold" textcolor={theme.fg} valign="center" />
      <frame pos={[0, -5]}>{props.children}</frame>
      <Script.Include lib="MathLib" as="ML" />
      <Script.Events key="window-close">{ms`
        if (Event.Type == CMlScriptEvent::Type::MouseClick && Event.ControlId == ${"close"}) {
          TriggerPageAction(${"close-window"});
        }
      `}</Script.Events>
    </frame>
  );
}

const xml = render(
  <Theme.Provider value={serverTheme}>
    <Manialink id="tmcp-window" name="TMCP:window">
      <Window title="Hello" width={100} height={60} />
    </Manialink>
  </Theme.Provider>,
);
```

## Requirements

### Functional

1. **JSX runtime**: `maniatsx/jsx-runtime` and `maniatsx/jsx-dev-runtime` exporting `jsx`, `jsxs`, `jsxDEV`, `Fragment`, and the `JSX` namespace. Works with `"jsx": "react-jsx"` + `"jsxImportSource": "maniatsx"` and with the per-file pragma `/** @jsxImportSource maniatsx */`.
2. **Tree first**: JSX creates plain immutable VNode objects. Nothing renders until `render()`. Components are plain synchronous functions `(props) => Node`.
3. **Node type**: `VNode | string | number | boolean | null | undefined | Node[]`. `null`/`undefined`/`true`/`false` render nothing; arrays flatten; Fragments render children only.
4. **Typed intrinsic elements** for every element in the Manialink v3 XSD (`frame`, `quad`, `label`, `entry`, `textedit`, `gauge`, `graph`, `framemodel`, `frameinstance`, `video`, `audio`, `camera`, `colorpicker`, `fileentry`, `slider`, `minimap`, `timeline`, `dico`, `language`, `stylesheet`, `style`, `script`, …), generated from the vendored XSD with its documentation as TSDoc, plus a hand-maintained overrides file for XSD mistakes and missing attributes.
5. **Attribute serialisation**:
   - `undefined`/`null` → attribute omitted.
   - `boolean` → `"1"`/`"0"`.
   - `number` → finite only (throw on `NaN`/`Infinity`), no exponent notation, at most 4 decimals with trailing zeros trimmed, `-0` → `0`.
   - `[x, y]` tuples (for `pos`, `size`, `scale`-like vector attrs) → `"x y"` with the number rules above. Strings are also accepted as-is.
   - `class`: `string | string[]`, arrays joined with a space, empties dropped.
   - Strings are XML-escaped (`& < > " '`, and `\n` → `&#10;` so multi-line text survives).
   - `data-*` attributes are allowed on every element (TS allows undeclared hyphenated JSX attributes).
6. **Children rules**: container elements (`manialink`, `frame`, `framemodel`, `dico`, `language`, …) take element children. Leaf elements take none. `script` takes text (`string` or `MsCode`), emitted inside `<!-- … -->`; content containing `--` anywhere throws (the game rejects it, per wiki.trackmania.io). Text children anywhere else throw at render time (and are a type error where possible).
7. **Components and context**: `createContext(default)` returns `{ Provider, id }`; `useContext(ctx)` works inside components during a render (synchronous render stack). `render(node, { contexts })` can also seed values.
8. **`<Manialink>` component**: emits optional XML prolog (`prolog: true` default), `<manialink version="3" id name layer?>`, its children, and the assembled script.
9. **Script composition** (`Script.*` components). These render no XML; they register parts with the nearest `<Manialink>`:
   - `Script.Include lib as` → deduplicated `#Include "lib" as alias` (conflicting aliases throw).
   - `Script.Globals`, `Script.Functions`, `Script.Main` (before the loop), `Script.Events` (inside `foreach (Event in PendingEvents)`), `Script.Loop` (after the events each frame).
   - An optional `key` dedupes a part, so a component rendered N times contributes its functions once.
   - Output order: includes, globals, functions, `main() { main parts; while (True) { yield; foreach (Event in PendingEvents) { events } loop parts } }`.
   - Parts are emitted in tree order. Without parts no `<script>` is emitted. Using both `Script.*` parts and a raw `<script>` inside one `<Manialink>` throws, because the game reads one script per page.
10. **`ms` tagged template** producing `MsCode`, interpolating JS values as safe ManiaScript literals: integer `number` → `42`; non-integer → `1.5`; `ms.real(n)` → `1.`/`1.5`; `ms.int(n)` asserts integer; `string` → `"…"` with `\\ \" \n` escaped; `boolean` → `True`/`False`; `ms.vec2(x, y)` → `<1., 2.>`; non-empty homogeneous arrays → `[a, b]`; nested `MsCode` and `ms.raw(text)` verbatim. `null`/`undefined`/objects/empty arrays throw.
11. **Escape hatch**: `raw(xml)` inserts trusted XML verbatim (migrating legacy templates).
12. **Render options**: `pretty` (indent for debugging; default compact), `prolog`, `contexts`, `onWarning(message)`.
13. **Dev warnings** via `onWarning` (default `console.warn`): duplicate `id` within one manialink, empty `pos`/`size` tuples, and an output over a configurable `warnBytes`.
14. **Text helpers**: `escapeFormatting(text)` (`$` → `$$`, so player names can't inject formatting codes) and `stripFormatting(text)`.

### Non-functional

- Zero runtime dependencies. ESM only. Ships compiled JS + `.d.ts` (`tsc`) so both Bun and Node consumers work.
- Rendering is synchronous and fast: a typical window (~200 nodes) renders in well under 1 ms. Benchmark included.
- Deterministic output: same input gives byte-identical XML (stable attribute order = prop order).
- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off for prop ergonomics).
- Comments short, per the user's global rules. No essays.

## Constraints

- **Manialink v3 only.** No v1/v2 attributes (`posn`, `sizen`).
- **The game is the only real validator.** Manialinks are parsed and scripts compiled client-side at runtime, with no standalone compiler. Mitigation: XSD validation in tests (`xmllint-wasm`) plus golden output, plus a manual real-server check before integration.
- **Synchronous render, no state, no hooks except `useContext`.** Server re-renders on change, as today.
- **Must coexist with React** in the gocontrolpanel monorepo: our `JSX` namespace comes from `jsxImportSource`, never the global one, so the web app's React types stay untouched.
- **One script per manialink**, and the script must be in an XML comment.
- **XSD is third-party (MIT, reaby/manialink-xsd, vendored at commit `c327ecbdf19d`)** and known to be imperfect (e.g. `linespacing` typed as bool). Generated types are regenerated, never hand-edited; fixes go to `src/intrinsics-overrides.ts`.
- **Runtime:** Bun 1.4 for dev, tests (`bun test`) and scripts; Node ≥ 20 compatible output.

## Architecture

```
vendor/manialink_v3.xsd          upstream schema (+ LICENSE)
scripts/gen-intrinsics.ts        XSD → src/generated/intrinsics.ts
src/
  types.ts                       VNode, Node, Component, MsCode, RawXml, attr value types
  jsx-types.ts                   JSX namespace (IntrinsicElements = generated & overrides)
  intrinsics-overrides.ts        hand fixes on top of the generated attributes
  generated/intrinsics.ts        GENERATED: per-element attribute interfaces
  jsx-runtime.ts                 jsx/jsxs/Fragment + JSX re-export
  jsx-dev-runtime.ts             jsxDEV (same as jsx)
  render.ts                      tree walk, context stack, XML writer, render collectors
  serialize.ts                   attribute value + text escaping, number formatting
  context.ts                     createContext/useContext
  manialink.tsx                  <Manialink>, Script.* parts and script assembly
  ms.ts                          ms tagged template and literal helpers
  text.ts                        escapeFormatting/stripFormatting
  index.ts                       public API
test/                            bun tests, type tests, XSD validation, golden files
examples/                        ports of the gocontrolpanel window/action-group templates
bench/                           render benchmark
```

Render pipeline: `render(node)` → walk VNodes depth-first with a render context (context stack, current manialink collector, warnings) → call components → intrinsic elements write `<tag attrs>` + children → `<Manialink>` renders children into a buffer first, then appends the assembled script, so parts registered anywhere below it are collected.

## Milestones

| # | Work | Owner | Done when |
|---|---|---|---|
| M0 | Scaffold: package, tsconfig, prettier, AGENTS.md, core type contracts, plan | lead | `bun install`, typecheck green |
| M1 | Core runtime: jsx-runtime, render, serialize, context, raw, Fragment, text helpers | subagent (Sonnet) | unit tests for every rule in Requirements 1–7, 11–14 |
| M2 | Intrinsics codegen from XSD + overrides + JSX namespace + type tests | subagent (Sonnet), parallel to M1 | `bun run gen` deterministic; type tests incl. `@ts-expect-error` cases pass |
| M3 | `<Manialink>`, `Script.*` composition, `ms` | subagent (Sonnet) | tests for ordering, dedupe, conflicts, literal escaping |
| M4 | Validation and quality: XSD validation tests, examples porting `window.hbs` + `action-group.hbs`, golden files, benchmark, README | subagent (Haiku for README/bench, Sonnet for examples) | all checks green; README shows setup + API |
| M5 | Review and real-server smoke test | lead + user | rendered example shows up in game without script errors |
| M6 (later, other repo) | Integrate into gocontrolpanel gbx-service, vendored as a Bun workspace package `packages/maniatsx` (decided 2026-11-02); decide the plugin story | separate plan | |

Each milestone ends with `bun run typecheck && bun test` green, and the lead reviews the diff.

## Risks and open issues

| Risk | Impact | Mitigation |
|---|---|---|
| XSD out of date or wrong for TM2020 (missing/mis-typed attributes) | false type errors or missing autocomplete | overrides file; `data-*` passthrough; regenerate on upstream changes; real-server test |
| Generated output passes XSD but the game rejects it (or the script fails to compile) | broken UI in game, found late | golden files reviewed by a human; M5 smoke test; conservative script assembly |
| Number formatting (float noise like `0.30000000000000004`, exponents) | misplaced controls or parse errors | single formatter with tests for edge cases |
| Injection: player-controlled text in attributes or script | broken XML, formatting abuse, script injection | always escape attributes; `ms` escapes strings; `escapeFormatting` for `$` codes; `raw` documented as trusted-only |
| JSX namespace clashes with React in the monorepo | type errors in web app | only `jsxImportSource`-scoped namespace; test a mixed setup in M6 |
| Plugins run sandboxed and ship Handlebars templates; TSX needs a build step | plugin authors can't use it directly | M6 decision: plugins precompile with Bun, or keep Handlebars for plugins |
| `Script.*` assembly hides control flow (shared `main`, variable name clashes between components) | hard-to-debug runtime script errors | stable documented layout; `key` dedupe; components prefix their globals; `pretty` output for debugging |
| `ms` literal typing: JS `number` cannot tell `Integer` from `Real` | `1` emitted where a Real is needed → script compile error | explicit `ms.real()`; documented; becomes a typed problem in phase 2 |
| Manialink size limits per page (exact limit unverified) | page silently dropped | `warnBytes` warning; compact output by default |
| Scope creep toward phase 2 (reactivity, TS→ManiaScript) | phase 1 never ships | phase 2 is explicitly out of scope; keep the VNode tree so phase 2 can build on it |

## Out of scope (phase 1)

Client-side state/reactivity, compiling TS to ManiaScript, async components, hooks other than `useContext`, a ManiaScript type checker, publishing to npm, gocontrolpanel integration.
