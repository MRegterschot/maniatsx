# M6: maniatsx in gocontrolpanel, with preset themes

## Goal

Replace the Handlebars manialinks in gocontrolpanel (gbx-service pages and sandboxed plugin widgets) with maniatsx, and replace the per-server color picker with preset themes that can change colors, fonts, sizes, positions, text and markup.

## Constraints from gocontrolpanel

- gbx-service renders core pages (window, widget, action group, table, codriver) in-process with `TemplateRenderer` (Handlebars) and `Manialink` components.
- Plugins render inside a QuickJS sandbox (`guest-runtime.ts`). Templates are precompiled by the host and `@theme` comes in as data (`info.theme`). Functions can't cross the sandbox boundary.
- Plugins are bundled by `tmcp-plugin build` with **esbuild**, not Bun.
- Coolify builds from GitHub, so maniatsx must be inside the gocontrolpanel repo (vendored workspace package `packages/maniatsx`, decided 2026-11-02).
- Plugin widgets update data through a paired `<template>-update` page that writes `declare … for This` variables the main page polls.
- Old plugins with `.hbs` templates must keep working during the transition.

## Decisions

### D1. Themes are data at the boundary

A theme crossing into the sandbox (or stored in the DB, or sent to the web panel) is `ThemeData = { id, name, chain, tokens, text, layout }`. Component overrides (`components`) stay host-only.

- Core primitives (`ui/panel`, `ui/label`, `ui/button`, `ui/table`, `ui/header`, `ui/window`) live in `@tmcontrolpanel/plugin-sdk/ui` as maniatsx slots, with a **variant per preset theme** (`slot(name, Default, { midnight, compact })`). Core and plugins bundle the same primitives, so a preset restyles plugin widgets too.
- Plugins built against an older SDK don't know a newer preset: the chain lookup falls back to the closest ancestor variant, then `Default`. Nothing breaks, it just looks like the parent theme.
- Widget skins for a preset ship with the widget (slot variants), so plugin authors opt in per preset.
- maniatsx needs `ThemeData` support: see T10.

### D2. Presets live in `packages/shared`

`packages/shared/src/themes/` defines the presets as data with `extends` (default, plus a few presets). gbx-service, the plugin SDK and the web panel all import them. The DB stores `{ preset: "<id>" }` in the existing `Server.theme` / `Group.theme` JSON columns, so no migration is needed. Old color JSON resolves to `default`. Resolution order stays server → first group → default.

### D3. Rendering paths

- **Core pages:** a `TsxRenderer` beside `TemplateRenderer`. `Manialink` gets a `component` option as an alternative to `template`. Pages migrate one by one; both renderers coexist until the last `.hbs` is gone.
- **Plugins:** the guest runtime accepts either precompiled Handlebars specs (old) or a plugin-provided render function (new: `ctx.ui.widget({ id, component })`, where the component is bundled into the plugin). maniatsx `render` runs inside QuickJS (zero runtime dependencies, plain ES2022).
- **Back-compat for `.hbs` plugins:** `@theme.quad.*` / `@theme.label.*` stay, filled from the preset's tokens through a fixed mapping in `packages/shared`.

### D4. Build

- `tmcp-plugin build` adds the maniatsx esbuild plugin (T11) when the plugin imports `maniatsx/client`. TypeScript 6 stays a build-time dependency of the SDK CLI, never of the plugin bundle.
- gbx-service uses the Bun plugin (preload) in dev and tests, and `maniatsx compile` (or the Bun plugin in `bun build`) for production images.

### D5. Data updates

The `-update` page pattern becomes a maniatsx primitive (T12): a shared, versioned client value with an explicit key. The update page writes it, the main page reads it, and bindings refresh when the version changes. This replaces the hand-written `declare … for This` + `LastXUpdate` timestamp pairs in every plugin template.

### D6. Actions

`action(name).trigger(...args)` sends `name|arg|…` (escaped). gbx-service's `ActionRouter` gets a parser for that format; plugin action prefixes keep working because the name is built with the existing `action` helper semantics.

### D7. Layout overrides

Presets may set `layout` per widget key (`<pluginId>/<widgetId>`). Server admins don't get per-widget overrides in this milestone (the point is presets, not pickers). The data model allows adding them later.

## maniatsx work before M6 (no game needed)

| # | Work | Owner |
|---|---|---|
| T10 | `ThemeData`: `kit.toData(theme)`, `ThemeProvider` accepting `ThemeData`; slots resolve variants by `chain` when there are no components | Codex |
| T11 | esbuild plugin sharing the Bun plugin's core (`maniatsx/esbuild-plugin`) | Codex |
| T12 ✅ | Shared versioned client values for update pages (design in PLAN-phase2 D5 first): `client.shared`, `client.watch`, `<Publish>`; in-game check of `for This` across pages still open | lead design, Sonnet |
| [x] T13 | Render-in-QuickJS smoke test: bundle a themed widget with esbuild and render it in `quickjs-emscripten` (dev dependency) | Codex |

T13 measurement: 47,108-byte bundle; QuickJS evaluation 14.35 ms; three preset renders 3.67 ms, 1.51 ms, and 1.24 ms (default, midnight, compact).

## gocontrolpanel milestones

| # | Work |
|---|---|
| G1 | Vendor maniatsx as `packages/maniatsx` (sync script recording the source commit); workspace wiring; typecheck both JSX setups (React in web, maniatsx in gbx-service) |
| G2 | Presets in `packages/shared`, `ThemeData` resolution, `.hbs` back-compat mapping, tests |
| G3 | `TsxRenderer` + `Manialink({ component })`; port window, widget, action group, table |
| G4 | Plugin SDK: `ui` primitives with preset variants, `ctx.ui.widget({ component })`, esbuild plugin in `tmcp-plugin build`, guest runtime support |
| G5 | Web: preset picker replacing the color form (server + group), preview via the existing theme preview component |
| G6 | Port first-party plugins (registry repo), starting with map-info; visual tests per preset |
| G7 | Remove Handlebars from core once nothing uses it (plugins keep `.hbs` support until a major SDK bump) |

## Risks

| Risk | Mitigation |
|---|---|
| QuickJS memory/time limits with a bigger render runtime | T13 measures it; maniatsx has no deps and renders by string concatenation |
| Two JSX runtimes in one monorepo | per-package `jsxImportSource`; G1 typechecks both |
| Presets drift from plugin skins | slot variant fallback; visual tests per preset in the plugins repo |
| Game semantics of `for This` across pages | Checked in game 2026-11-16: shared across layers, survives a re-send, and outlives the layer (a later page sees the last published value). Namespace shared keys per plugin (`<pluginId>.<key>`) so stale values from another plugin or an earlier session can't leak in |
