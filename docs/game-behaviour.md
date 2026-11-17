---
title: Game behaviour reference
description: How Trackmania actually renders manialinks and runs their scripts, measured in game.
sidebar:
  order: 7
---

# Game behaviour reference

Valid XML is not the same as a page that looks right. Everything on this page was measured in TM2020 (engine 2026-02-02, Openplanet 1.29) with the [visual test tools](testing.md). None of it is caught by the XSD, by goldens or by the offline ManiaScript parser.

## Screen and coordinates

- The screen is 320 × 180 units with the origin at the center and y pointing up. At 1920×1080 one unit is 6 px.
- An element's `pos` is its top-left corner by default. `halign`/`valign` change which point of the element `pos` refers to.
- Frames clip their children to the frame's `size`. A child positioned outside its frame is cut off, not just misaligned. Give nested panels their own `pos` instead of positioning their children relative to the outer widget.

```tsx
// The rows live inside the body panel, so their y is relative to it
<frame pos={[0, -5]} size={[55, 23.5]}>
  <label pos={[2, -2.8]} text="1" />
</frame>
```

## Text

### Fonts

- Valid TM2020 font names include `GameFontRegular`, `GameFontSemiBold`, `GameFontExtraBold` and `GameFontBlack`. An unknown name (`GameFont`, `GameFontBold`) falls back to the default font silently: nothing becomes bold and there is no error.
- `GameFont*` are Montserrat-like faces shipped as bitmap atlases.
- **Digits are tabular** (all the same width); letters are proportional. A narrow `1` sits centered in a full-width cell, which is why `A01` shows a gap after the `1`.

### Size

`textsize` is not linear in pixels. Measured at 1920×1080:

| textsize | font size | cap height |
| -------- | --------- | ---------- |
| 1        | 16.5 px   | 12 px      |
| 1.5      | 19.5 px   | 13 px      |
| 2        | 22.5 px   | 15 px      |
| 3        | 28.5 px   | 19 px      |

So font px ≈ 10.5 + 6 × textsize, or 1.75 + textsize in units. Small text is much bigger than a linear guess suggests. When designing, calibrate against a screenshot, not the number.

### Alignment

- `halign="right"` makes `pos` the label's **right** edge. With a `size` of 20, `pos={[33, y]}` does not right-align the text at x 53: use `pos={[53, y]}`.
- Text ink starts about 2 px right of `pos` for left-aligned labels and ends about 3 px left of `pos` for right-aligned ones.
- With `valign="top"` the cap top sits about 1.25 + 0.9 × textsize px below `pos`. With `valign="center"` it sits about 2.9 + 1.2 × textsize px above `pos`.

### Width

A label squeezes its text **horizontally** (height unchanged) when the text is wider than the label's `size`. There is no ellipsis and no warning: the text just gets narrower. Label widths are part of the design.

### Icons

Font Awesome codepoints work in any `GameFont*` label (for example `""` for a map). The game's icon set is older than Font Awesome 6: `` is a map pin in game, while FA6 moved it to ``. An icon fills a square box of roughly the font size, starting at `pos`.

### Attributes

- Use `textcolor` on labels. `color` is not a v3 label attribute and is ignored.
- `textprefix` can carry formatting codes: `textprefix="$i"` italicises the label's text.

## Scripts

### `main()` after globals

`main()` directly after global declarations is a syntax error in game (`syntax error, unexpected main`), while `@maniascript/parser` accepts it. maniatsx inserts an empty function between them when no real one sits there, and its tests flag the pattern.

### Persistent storage

- `declare T X for Page` and `declare T X for This` keep their value when the page is re-sent with the same manialink id.
- The initializer (`= value`) only applies the first time.
- **`for This` storage is shared between layers and outlives them.** A page shown later sees the last value another page published, even after that page was destroyed. Namespace keys (`<pluginId>.<key>`) and don't assume a fresh start.
- Struct-typed `for This` variables and `K_Struct { field = value }` literals work. A function may re-declare a `for This` / `for Page` variable that `main()` also declares.

### Event handling

- Controls only send events when they have an `id` and `scriptevents="1"`; maniatsx adds both for elements with client handlers.
- Page actions from `TriggerPageAction` arrive on the server as `PlayerManialinkPageAnswer` with the raw string; maniatsx actions send `name|arg|…` with `|` escaped.

## Layers

- Every manialink id is its own UI layer. Layers from different pages draw on top of each other; hiding the native HUD means hiding its layers, which are manialinks too.
- `LocalPage.MainFrame` of a layer reports junk for its own position and scale (`pos [-1,-1]`, `scale -1`). Ignore the root when reading a page's layout.

## Screenshots

- The game can capture itself at a forced resolution (`Viewport.ScreenShotForceRes` + `ScreenShotDoCaptureTga()`), independent of the window size or focus.
- The file name is reused when the previous shot was deleted, so detect a new shot by "file didn't exist before", not "name changed".
