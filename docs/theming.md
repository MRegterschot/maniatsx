---
title: Theming
description: Define theme tokens, text, layout, and component slots for reusable Manialink views.
sidebar:
  order: 5
---

# Theming

A theme kit defines a base theme and related themes. Tokens are typed and deeply merged; text and layout are keyed data. Theme application happens during rendering, so changing a theme requires re-sending pages.

## Tokens, text, and layout

```tsx
const kit = createThemeKit<Tokens>({
  id: "default",
  name: "Default",
  tokens: { color: { surface: "222" } },
});
const midnight = kit.defineTheme({
  id: "midnight",
  name: "Midnight",
  tokens: { color: { surface: "112" } },
});

const tokens = kit.useTokens();
const title = kit.useText("map-info.title", "Map");
```

`useTokens()` returns merged tokens. `useText(key, fallback)` returns themed text or its fallback (the key by default). Layout entries are keyed by widget name and can set `anchor`, `margin`, `size`, `scale`, and `hidden`.

## ThemeData

`kit.toData(theme)` creates serialisable `ThemeData`: `id`, `name`, `chain`, `tokens`, `text`, and `layout`. It excludes component functions. `ThemeProvider` accepts either a full theme or `ThemeData`; data themes resolve slot variants by their chain, without host component overrides.

## Slots, variants, and overrides

A slot names a replaceable view and may ship variants keyed by theme ID. Theme overrides take precedence. Without an override, the slot chooses the first matching variant in the theme chain, then `Default`.

```tsx
const Panel = slot<PanelProps>("ui/panel", DefaultPanel);
const compact = kit.defineTheme({
  id: "compact",
  name: "Compact",
  components: [override(Panel, ({ Default, ...props }) => <Default {...props} variant="thin" />)],
});
```

A widget can ship its own per-preset variants. A new preset can fall back to the nearest known ancestor variant or `Default`.

## Anchored layout

`Anchored` reads the effective layout through `useLayout` and places its child using `anchorPos`. The coordinate space is 320 × 180, centered at the origin, with y increasing upward. Margins are inward from the selected edge; size is unscaled content size, with scale applied to position calculations.

```tsx
<Anchored name="map-info" layout={{ anchor: "top-right", margin: [2, 2], size: [55, 10] }}>
  <MapInfoView />
</Anchored>
```

## Separate logic from view

Keep client state, handlers, bindings, and refs in the widget logic. Pass them as typed props to a view slot so skins can change markup without changing behaviour. A skin must place each used ref exactly once.

```tsx
const nameRef = client.ref<CMlLabel>();
client.onInit(() => {
  nameRef.control.Value = name;
});
return <View name={name} nameRef={nameRef} />;
```

Source: `src/theme.ts`
