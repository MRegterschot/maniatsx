# maniatsx

Write Trackmania manialinks in TSX with full type checking, and render them to Manialink v3 XML.

**Status: phase 1, server-side TSX to XML.** ManiaScript is still hand-written, but composed and parameterised safely. See [PLAN.md](PLAN.md).

## Setup

Not on npm yet. Run `bun run build` and depend on the package from a local path; it loads from `dist/`.

```json
{
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "maniatsx" }
}
```

In a project that also uses React, keep React's JSX setup and opt single files in with the pragma. It needs `"jsx": "react-jsx"` (or `react-jsxdev`):

```tsx
/** @jsxImportSource maniatsx */
```

## Quick start

```tsx
import { Manialink, render } from "maniatsx";

const xml = render(
  <Manialink id="hello" name="TMCP:hello">
    <frame pos={[-20, 10]} size={[40, 8]}>
      <quad size={[40, 8]} bgcolor="000000cc" />
      <label pos={[2, -4]} size={[36, 6]} text="Hello" textsize={2} valign="center" />
    </frame>
  </Manialink>,
);
```

`render()` returns a string with the XML prolog first; `<Manialink prolog={false}>` drops it. Nothing renders before `render()` is called.

## Attributes

- `undefined` and `null` omit the attribute. Numbers get at most 4 decimals and no exponent; `NaN` and `Infinity` throw.
- Booleans become `"1"` or `"0"`. Tuples: `pos={[10, -5]}` becomes `pos="10 -5"`. Strings pass through.
- `class` takes a string or an array; empty items are dropped: `class={["btn", active ? "btn-on" : ""]}`.
- `data-*` is allowed on every element. Values are XML-escaped, so player text in attributes is safe.
- Text children are only allowed in `<script>`, `<style>` and `<stylesheet>`. Use `text=` on `<label>`.

## Components and context

Components are plain synchronous functions `(props) => Node`. `useContext` works only during a render, so call it in a component body.

```tsx
import { createContext, useContext } from "maniatsx";

const Theme = createContext({ fg: "ffffff" });

function Title(props: { text: string }) {
  return <label text={props.text} textcolor={useContext(Theme).fg} />;
}

<Theme.Provider value={{ fg: "ffcc00" }}>
  <Title text="Ranking" />
</Theme.Provider>;
```

Seed a value from outside the tree with the `contexts` option: `render(node, { contexts: [[Theme, { fg: "ffcc00" }]] })`.

## Script composition

`Script.*` components render no XML. They register parts with the nearest `<Manialink>`, which assembles them into one `<script>`.

```tsx
import { Script, ms } from "maniatsx";

function ClickCounter(props: { control: string }) {
  return (
    <>
      <Script.Globals id="clicks">{ms`declare Integer G_Clicks;`}</Script.Globals>
      <Script.Main id="clicks">{ms`G_Clicks = 0;`}</Script.Main>
      <Script.Events id={props.control}>{ms`
        if (Event.Type == CMlScriptEvent::Type::MouseClick && Event.ControlId == ${props.control}) {
          G_Clicks += 1;
        }
      `}</Script.Events>
    </>
  );
}
```

- `Script.Include lib="MathLib" as="ML"` emits `#Include`. Reusing a lib with another alias, or an alias for another lib, throws.
- `Script.Globals` and `Script.Functions` go at top level. `Script.Main` runs at the start of `main()`. `Script.Events` runs inside the event loop, where `Event` is the loop variable. `Script.Loop` runs every frame after the events.
- `id` dedupes a part within its slot, first wins. It is not `key`, which JSX consumes. A component rendered 40 times can emit its functions once.

The output is the last child of `<manialink>`, in an XML comment: includes, globals, functions, then `main() { main parts; while (True) { yield; foreach (Event in PendingEvents) { events }; loop parts } }`. Without parts there is no `<script>`. Mixing `Script.*` with a raw `<script>` in one page throws.

## The ms template

`ms` turns JS values into ManiaScript literals, so interpolated text cannot break out of its literal. `ms\`Name = ${"Bo\"b"}\``gives`Name = "Bo\"b"`.

| JS value        | ManiaScript                    |
| --------------- | ------------------------------ |
| `42` / `1.5`    | `42` / `1.5`                   |
| `ms.real(1)`    | `1.`                           |
| `ms.int(7)`     | `7` (throws if not an integer) |
| `true`          | `True`                         |
| `ms.vec2(1, 2)` | `<1., 2.>`                     |
| `[1, 2]`        | `[1, 2]` (non-empty, one type) |

- JS cannot tell `Integer` from `Real`, so use `ms.real` where ManiaScript needs a Real. Integers outside the 32-bit range throw; use `ms.real` for large whole numbers.
- `null`, `undefined`, objects, and empty or mixed arrays throw. Nested `ms` code is inserted as is.
- `ms.raw(text)` inserts text verbatim. Trusted only.
- Strings escape `\`, `"`, newlines and tabs. `-->` is split (`"a--" ^ ">b"`) so it cannot close the script's XML comment.

## Raw XML and player text

`raw(xml)` inserts XML verbatim. Use it only for XML you built, never for player text.

Player names may contain `$` colour codes. `escapeFormatting` neutralises them for display; `stripFormatting` removes them for measuring or comparing:

```tsx
<label text={escapeFormatting(player.name)} />;
stripFormatting("$f00Bob$z"); // "Bob"
```

## Render options

```ts
const warnings: string[] = [];

render(node, {
  pretty: true, // two-space indent, one element per line
  contexts: [[Theme, { fg: "ffcc00" }]],
  onWarning: (message) => warnings.push(message), // default: console.warn
  warnBytes: 60_000, // warn when the output is larger
});
```

Warnings cover duplicate `id`s, omitted empty tuples or arrays, and oversized output. Invalid values, names and placements throw.

## Typings

Element and attribute types are generated from `vendor/manialink_v3.xsd` (reaby/manialink-xsd, MIT, see `vendor/LICENSE-manialink-xsd`) into `src/generated/intrinsics.ts`. Schema mistakes and gaps are fixed in `src/intrinsics-overrides.ts`; for example `linespacing` is a number, and the v1/v2 `posn` and `sizen` are removed. Run `bun run gen` after the XSD changes. Never edit `src/generated/` by hand.

## Development

```sh
bun install
bun run typecheck   # tsc --noEmit over the whole project
bun test            # unit, type, golden and XSD validation tests
bun run gen         # regenerate typings from the XSD
bun run build       # emit dist/
bun run bench       # render benchmark
./node_modules/.bin/prettier --write <files>   # not bunx
```

Conventions are in [AGENTS.md](AGENTS.md).

## Roadmap

Phase 2 compiles a TypeScript subset to ManiaScript: client state, event handlers and server actions. Phase 1 keeps the VNode tree so phase 2 can build on it. See [PLAN.md](PLAN.md).
