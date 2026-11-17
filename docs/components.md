---
title: Components
description: Build Manialink pages from typed intrinsic elements, components, scripts, and render options.
sidebar:
  order: 3
---

# Components

## Intrinsic elements and attributes

Intrinsic element names and attributes are typed from the Manialink v3 schema, with local corrections. Common elements include `frame`, `quad`, `label`, `entry`, and `dico`. Vector attributes accept tuples such as `pos={[-20, 10]}`. `data-*` attributes are also accepted. `null` and `undefined` omit attributes; booleans become `1` or `0`; non-finite numbers throw. Strings are XML escaped.

Text children are only valid in script, style, and stylesheet elements. Use `text` on a label. See [game behaviour](game-behaviour.md) for rendering details measured in Trackmania.

## Components and context

Components are synchronous functions returning nodes. `useContext` is available while rendering a component:

```tsx
import { createContext, useContext } from "maniatsx";

const Theme = createContext({ fg: "ffffff" });
function Title(props: { text: string }) {
  return <label text={props.text} textcolor={useContext(Theme).fg} />;
}
```

`render(node, { contexts: [[Theme, { fg: "ffcc00" }]] })` seeds context from outside the tree. Components can compose and return fragments or `null`.

## Manialink

`<Manialink>` emits the root element with version 3, `id`, `name`, and optional `layer`. Its XML prolog is on by default; set `prolog={false}` to omit it. It also collects composed `Script.*` parts and emits one script comment at the end.

## Script composition

`Script.Include`, `Script.Globals`, `Script.Functions`, `Script.Main`, `Script.Events`, and `Script.Loop` register code with the nearest Manialink. Ordering follows tree order within each slot; assembled output orders includes, globals, functions, main, events, then loop. `id` deduplicates within a slot (first occurrence wins). It is distinct from JSX `key`.

```tsx
import { Script, ms } from "maniatsx";
<Script.Globals id="counter">{ms`declare Integer G_Count;`}</Script.Globals>
<Script.Main id="init">{ms`G_Count = 0;`}</Script.Main>
```

Do not mix composed parts with a raw `<script>` in one page.

## The ms template

`ms` safely converts interpolated values to ManiaScript literals. Strings are quoted and escaped; use `ms.real(1)` when an integer-valued JS number must be a ManiaScript Real. `ms.int` checks integer input, `ms.vec2` emits a vector, and `ms.raw(text)` inserts trusted source verbatim. Nullish values, objects, and empty or mixed arrays throw. See [theming](theming.md) for client-side composition patterns.

## Raw XML and player text

`raw(xml)` inserts XML verbatim and is only for trusted XML. For player names, `escapeFormatting` neutralises Trackmania `$` formatting codes before display; `stripFormatting` removes codes for comparisons or measuring.

## Dico

`<Dico translations={{ fr: { greeting: "Salut" }, en: { greeting: "Hello" } }} />` creates a dictionary. Language and entry order is preserved; the last language is the game's fallback. Reference an entry with `textid="greeting"`.

## Render options

`render(node, options)` accepts `pretty`, `contexts`, `onWarning`, and `warnBytes`. Warnings report duplicate IDs, omitted empty tuples or arrays, and output over the byte threshold. Invalid values and invalid placements throw. The default warning handler is `console.warn`.

Source: `src/index.ts`
