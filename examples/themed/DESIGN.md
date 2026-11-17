# Themed HUD scene: design spec

Screen 320×180 units (6 px per unit at 1920×1080), origin at the center, y up. Positions below are offsets inside the widget (x right, y down from its top-left).

## Widgets

**map-info** (exists): layout key `map-info`, anchor top-right, margin [2, 2], size 55×10.

**records** (new): layout key `records`, anchor top-right, margin [2, 14], size 55×28.5.
- Header, 0..55 × 0..5: `ui/panel` background, then the title "Records" (`text` key `records.title`) at x 2, vertically centered, textsize 1.5, title font, `text` color. On the right, at x 53 right-aligned, the record count "5" in `textMuted`, textsize 1.
- Rows start at y 5.5, row height 4.6, 5 rows. Row background: `surfaceAlt` at opacity 0.5 on odd rows (1st, 3rd, 5th) only, full width.
- Per row, vertically centered: rank at x 2 (textsize 1, `textMuted`, body font), name at x 7 (textsize 1, `text`, body font, width 30), time right-aligned at x 53 (textsize 1, title font, `text`; the 1st row's time uses `accent`).
- The local player's row ("You", 5th) gets a 0.6-wide `accent` bar at x 0 and its name in `accent`.
- Behind the rows: one `ui/panel` covering 0..55 × 5..28.5 with `surface` at `opacity.panel`.
- Data: 1 Wirtual 0:24.512, 2 Scrapie 0:24.689, 3 Massa 0:24.731, 4 Gwen 0:24.902, 5 You 0:25.118.

## Themes

| Token | default | midnight | compact | paper |
|---|---|---|---|---|
| surface | 222 | 112 | (default) | EEE |
| surfaceAlt | 333 | 223 | (default) | D8D8D8 → DDD |
| accent | 4CF | 8AF | (default) | F60 |
| text | FFF | DDF | (default) | 222 |
| textMuted | AAA | 89A | (default) | 666 |
| opacity.panel | 0.9 | (default) | (default) | 0.95 |

- **compact**: map-info moves to top-left with scale 0.8 and its compact skin (exists). records: anchor top-left, margin [2, 12], scale 0.8. Panels use the thin variant (exists).
- **paper**: extends default. Overrides `ui/panel` to add a 0.6-wide `accent` stripe along the panel's left edge, full height, above the background. `records.title` text is "Top times". map-info icon stays the default one.

## Game text rules (measured in game, 2026-11-17)

- `GameFontRegular` / `GameFontSemiBold` are Montserrat-like at about 10.5 + 6 × textsize px (1080p), with **tabular digits** and proportional letters.
- A label squeezes its text horizontally (height unchanged) when the text is wider than the label's `size`. Label widths are part of the design: map-info name 43 (compact 25), author 43 (compact 18), records name 30, time 20.
- `bun run design:diff` compares the mockups with the in-game baselines. Remaining differences are a few anti-aliasing pixels in right-aligned and squeezed text, from the game's own glyph filtering.
