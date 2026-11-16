# maniatsx phase 2: client-side TypeScript → ManiaScript

## Goal

Write manialink client logic (state, event handlers, bindings, calls to the game API) in TypeScript inside the same TSX components as the markup. A build step compiles it to ManiaScript. Phase 1's renderer stays the runtime: compiled code plugs into the existing `Script.*` assembly, so there is no second output path.

## Target usage

```tsx
import { Manialink } from "maniatsx";
import { action, client, type Integer } from "maniatsx/client";
import { TextLib } from "maniatsx/maniascript";

const reset = action("counter-reset");

export function Counter({ title, start }: { title: string; start: Integer }) {
  const count = client.state<Integer>(start); // server value becomes the initial value

  return (
    <frame>
      <label text={title} />
      <label text={client.bind(() => "Clicks: " + TextLib.ToText(count.value))} />
      <quad size={[20, 8]} onClick={client.handler(() => { count.value += 1; })} />
      <quad size={[20, 8]} onClick={client.handler(() => reset.trigger())} />
    </frame>
  );
}
```

At render time this produces normal XML plus a script with a `declare Integer` global, a click dispatcher in the events slot, a dirty-checked binding update in the loop slot, and `TriggerPageAction("counter-reset")`.

## Design decisions

### D1. Build-time transform, runtime holes

Client closures (`client.handler`, `client.bind`, `client.onInit`, `client.onFrame`, `client.fn`) are compiled **at build time** into ManiaScript templates with numbered holes. The call site is rewritten into a descriptor: `{ code: string[], holes: (() => unknown)[], types: MsType[] }`. At render time, holes are filled with server values using phase 1 `ms` literal rules, but the type comes from the compiler (Integer vs Real), not from the JS value. Server values cross the boundary only as literals. No eval, no network state.

- Distribution: a Bun plugin (`maniatsx/bun-plugin`, an `onLoad` for `.tsx`) for Bun projects (gbx-service), plus `maniatsx compile <in> <out>` for others. Without the transform, client constructs throw at render time with "not compiled" and point at the setup docs.
- Compiler API: TypeScript 7's programmatic checker is only exposed as `typescript/unstable/*` (an IPC API). The compiler uses **TypeScript 6.0.x's stable JS API** (`typescript6` npm alias, dev and build dependency). TS 7 stays the `tsc` for typechecking. Revisit when TS 7's API stabilises.

### D2. Numbers: aliases plus compiler-enforced annotations

`type Integer = number` and `type Real = number` are plain aliases, so ordinary TS stays ergonomic. The compiler reads the **alias symbol** of declared types to tell them apart:

- Every numeric state, variable, parameter and struct field in client code must be declared `Integer` or `Real`. A bare `number` is a compile error with a fix-it message.
- Literals take the expected type (`1` in a Real context emits `1.`).
- Mixing Integer and Real in a binary operation is an error; convert explicitly (`MathLib.ToReal`, `MathLib.NearestInteger`).
- `/` on Integers is integer division in ManiaScript. The compiler warns when both operands are Integer and the result is assigned to Real.
- Integer is 64-bit (wiki.trackmania.io). Captured JS values must be safe integers.

### D3. Type mapping

| ManiaScript (doc.h) | TypeScript |
|---|---|
| `Integer`, `Real` | `Integer`, `Real` aliases of `number` (D2) |
| `Boolean`, `Text`, `Void` | `boolean`, `string`, `void` |
| `Vec2`, `Vec3`, `Int2`, `Int3` | readonly interfaces `{ X; Y; (Z) }` + constructors `vec2(x, y)` … → `<x, y>` |
| `Ident` | branded `Ident`; `NullId` constant. Idents are client-side handles, so server values can't be captured as Ident: capture Text and look it up on the client |
| `Array<T>` / `T[]` | `T[]`; associative `T[K]` → `Record<K, T>` (string/Integer/Ident keys) |
| `class CMlLabel : public CMlControl` | `interface CMlLabel extends CMlControl` (class objects are references; nullable as `T \| null` → `Null`) |
| `enum` inside a class | `CMlScriptEvent.Type.MouseClick` (a namespace + const object), emitted as `CMlScriptEvent::Type::MouseClick` |
| `const` members | `readonly` |
| overloaded methods | TS overloads |
| `namespace TextLib { … }` (MathLib, TextLib, TimeLib, ColorLib, AnimLib, MapUnits) | exported `namespace` objects from `maniatsx/maniascript`; usage triggers `#Include "TextLib" as TextLib` automatically |
| `interface`/object type in client code | `#Struct K_<Name> { … }` (fields typed per this table) |

The API typings are generated from the TM2020 `doc.h` published in bigbang1112/maniascript-reference (build 2026.2.2.1751), parsed with `@maniascript/api` (LGPL-3.0, dev-only). The generated `.d.ts` files are committed.

### D4. Supported TypeScript subset (client code only)

| Allowed | Emitted as |
|---|---|
| `const` / `let` with initialiser | `declare` (typed) / `let` |
| `if`/`else`, `while`, `break`, `continue`, `return` | same |
| `for (const x of arr)`, `for (const [k, v] of Object.entries(rec))` | `foreach (X in Arr)`, `foreach (K => V in Rec)` |
| `for (let i = a; i < b; i++)` (this exact shape) | `for (I, a, b - 1)` |
| `switch` over enum/Integer/Text | `switch` |
| `cond ? a : b` | temp variable + `if`/`else` |
| template literals, `+` on strings | `^` concatenation (numbers convert implicitly) |
| `===`/`!==`, `&&`, `\|\|`, `!` | `==`/`!=`, `&&`, `\|\|`, `!` |
| `x as CMlLabel` | `(x as CMlLabel)` |
| `arr.length`, `push`, `includes`, `indexOf`, `splice(i, 1)`, `Object.keys` | `.count`, `.add`, `.exists`, `.keyof`, `.removekey`, `.keys` (whitelist; anything else errors) |
| `Math.abs/min/max/floor/round/…` | `MathLib` equivalents (`ML::Abs`, …) |
| `console.log` | `log()` |
| `client.fn` top-level functions | ManiaScript functions (recursion allowed, no closures) |

**Rejected with an error naming the node:** classes, `this`, closures other than client constructs, async/await, generators, try/catch/throw, spread/rest, destructuring (except `Object.entries` pairs), optional chaining, `??`, regex, `Date`, `JSON`, `delete`, `typeof`, `instanceof`, union types other than `T | null` on class refs, and any import outside `maniatsx/client` and `maniatsx/maniascript`.

### D5. Runtime model

- **IDs:** elements with client props get a deterministic id at render time (`mtx-<scope>-<n>`) unless they already have one. `scriptevents="1"` is added automatically.
- **State:** `client.state<T>(init)` → `declare T Mtx_S<n>;`, initialised in the main slot from the hole value. Writes compile to an assignment plus `Mtx_Dirty = True;`.
- **Persisted state:** `client.state<T>(init, { persist: true, key?: "name" })` survives the page being re-sent (same manialink id and layer). It emits `declare T Mtx_P_<key> for Page = <init>;` at the top of main (the initial value only applies the first time) and re-binds it with `declare T Mtx_P_<key> for Page;` at the top of every handler or `client.fn` body that touches it, because `for Page` declarations are local to a function and cannot be global. The options must be literals. Without `key` the name is `Mtx_P_<file stem>_<hash of file:line:col>`, so moving the `client.state` call resets stored values; give it a `key` for a name that survives edits. The same site rendered twice gets a `_2` suffix; duplicate explicit keys throw. Writes mark dirty like any state. Needs in-game verification (P2-7).
- **Dirty flag:** only pages with at least one `client.bind` declare `Mtx_Dirty`, set it in main and poll/reset it in the loop. The compiler still emits `Mtx_Dirty = True;` after every state write; the assembler drops those statements when the page has no bindings, so handler-only pages carry no flag.
- **Bindings:** `client.bind(fn)` on a whitelisted attribute → the initial value is computed client-side in main, and updated in the loop slot when `Mtx_Dirty`. Whitelist: label `text` → `.Value`, `hidden` → `.Visible = !…`, `pos` → `.RelativePosition_V3`, `opacity` → `.Opacity` (label, quad), gauge `ratio` → `.Ratio`, quad `image` → `.ChangeImageUrl()`, quad `bgcolor` → `.BgColor` (Vec3 from hex), entry `default` → `.Value`. Others are a compile error.
- **Handlers:** `onClick`, `onRightClick`, `onMouseOver`, `onMouseOut` (+ `onSubmit` for entry, `onKeyPress` page-level) → `Void Mtx_H<n>()` functions plus dispatch in the events slot on `Event.Type` + `Event.ControlId`. Identical compiled handlers are deduped by hash.
- **Actions:** `action(name)` → `.trigger(…args: string[])` emits `TriggerPageAction(name ^ "|" ^ …)`, escaping `|`. The server side gets a typed parser for the payload (to be wired into gbx-service's ActionRouter in M6). Named entries are sent with the action by the game.
- **Refs:** `client.ref<CMlX>()` (type argument required) + `ref={r}` on any element → the element gets its `id` (or `mtx-<n>`); a used ref emits `declare CMlX Mtx_R<n>;` and `Mtx_R<n> <=> (Page.MainFrame.GetFirstChild("<id>") as CMlX);` first in main, and `r.control` in client code compiles to `Mtx_R<n>`. Render throws (naming the ref's file:line) when a used ref is never attached or is attached twice. See PLAN-theming.md T4.
- **Lifecycle:** `client.onInit` → main slot; `client.onFrame` → loop slot (runs every frame, so the docs warn about cost).
- Everything goes through the phase 1 `Script.*` slots, so hand-written `ms` parts and compiled parts can coexist in one page.

### Mappings corrected against doc.h (2026-11-02)

- `Object.keys(rec)` has no ManiaScript equivalent (`.keys` doesn't exist): it lowers to a temp array filled by `foreach (K => V in Rec)`, so it's rejected where a statement can't be inserted (bindings, right side of `&&`/`||`).
- `splice(i, 1)` → `.removekey(i)`: doc.h only lists `removekey` on associative arrays, the wiki uses it on lists. Verify in game (P2-7).
- `Math.floor/round/ceil` → `MathLib::FloorInteger/NearestInteger/CeilingInteger` (they return Integer; `NearestInteger` may round negative halves differently from JS). Math functions missing from doc.h are rejected.
- Class-typed declarations and assignments use `<=>`, including `X <=> Null`.
- `ml` is typed `CSmMlScriptIngame`, the context TM2020 ingame layers run in (`InputPlayer`, `GUIPlayer`, `Players`).
- Lib qualifiers (`MathLib::`, `TextLib::`) are `lib` holes, not text: they resolve to the page's existing alias (`#Include "MathLib" as ML` → `ML::Abs`) or include the lib under its own name. Compiled and hand-written parts can share a page whatever their include order.

## Requirements

1. The compiler rejects everything outside D4 with a source-mapped error (file:line:col, node text, suggestion).
2. The output is deterministic (stable naming, ordering) and passes `@maniascript/parser` syntax checks in tests.
3. Client code typechecks with plain `tsc` against the generated API typings and gets editor autocomplete.
4. Rendering a compiled component costs no more than a hand-written phase 1 equivalent (holes are filled by string concatenation).
5. Without the build transform, client constructs fail loudly. Server-only components are unaffected.
6. A golden test suite holds TS input → ManiaScript output pairs for every D4 row and every D5 feature.

## Milestones

| # | Work | Suggested owner |
|---|---|---|
| P2-0 ✅ | Offline ManiaScript syntax check (`@maniascript/parser`) for phase 1 goldens and `Script.*` output | Codex |
| P2-1 ✅ | Generate API typings from `doc.h` (D3), committed under `src/maniascript/` | Codex |
| P2-2 ✅ | Compiler core: TS 6 program, client-closure discovery, capture/hole analysis, D2 number typing | Sonnet + lead review |
| P2-3 ✅ | Lowering of the D4 subset + golden tests | Sonnet / Codex |
| P2-4 ✅ | Runtime: `client.state/bind/handler/onInit/onFrame/fn`, `action`, auto ids, dirty loop (D5) | Sonnet |
| P2-5 ✅ | Bun plugin + `maniatsx compile` + "not compiled" errors | Codex |
| P2-6 ✅ | Port one real widget (the gocontrolpanel action group toggle) to client TS; compare with the hand-written script (see below) | lead |
| P2-7 | In-game verification of all goldens (needs the game) | user + lead |

### P2-6 result: action group toggle (`examples/action-group.tsx`)

- Split into `ActionGroup` (logic: `client.state`, two `client.ref`s, one `client.handler` calling `AnimMgr.Add`) and `ActionGroupView` (a `slot()` view taking the handler and refs as props; a skin replaces it). No hand-written ManiaScript is left in the component and no `src` change was needed.
- Hand-written script: 16 lines (1 in `Script.Main`, 15 in `Script.Events`). Compiled: 26 script lines specific to the toggle (handler 14, globals 4, ref and state init 3, dispatch 1, dirty flag 4). The whole `<script>` grows from 36 to 41 lines. The TS body is 14 lines.
- Behaviour differences: the handler is attached by id (`mtx-3`) instead of `HasClass("trigger")`, so the quad lost its `class="trigger"` and gained ids on the slider frame, chevron label and trigger quad; the animated frame and icon are resolved once through refs instead of `Event.Control.Parent.Controls[...]` each click; the open flag is a plain global instead of `declare ... for This`, so it resets when the page is re-sent; it also sets `Mtx_Dirty` although nothing is bound (one wasted assignment per frame, cheap).
- Left over elsewhere: `widget.tsx` still hand-writes `sleep(300); widget.Show();` (D4 has no `sleep`/`yield`).

## Risks

| Risk | Mitigation |
|---|---|
| Real game semantics differ from the parser's view (it checks syntax, not types or runtime) | P2-7 in-game pass before anyone relies on it; keep emitted code boring |
| doc.h drift between game builds | regenerate script; build id stamped in the generated header |
| TS 6 vs TS 7 differences in parsing user code | only syntax both support; CI typechecks with 7, compiles with 6 |
| Aliased `Integer`/`Real` give no TS-level safety | compiler-enforced annotations (D2); clear error messages |
| Debuggability: errors in game point at generated code | readable output with `// src/file.tsx:12` comments in pretty mode; stable names |
| Scope creep into a general TS→ManiaScript compiler | D4 is a closed whitelist; extend only for a real widget's needs |
| LGPL tooling (`@maniascript/*`) | dev/test-only dependencies, never bundled into `dist` |
