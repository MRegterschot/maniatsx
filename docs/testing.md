---
title: Testing
description: Check generated XML, ManiaScript, and in-game appearance with the project test tools.
sidebar:
  order: 6
---

# Testing

## Goldens and schema validation

`bun test` runs unit and type tests, compares golden outputs, and validates XML against the vendored Manialink v3 XSD. To intentionally regenerate golden files, set `UPDATE_GOLDEN=1` for the relevant test run, then inspect every changed fixture.

## ManiaScript syntax

The test suite checks generated ManiaScript syntax with the offline parser. This does not prove the game accepts or runs the script; see [game behaviour](game-behaviour.md) for measured runtime details.

## Visual tests

Install the ManialinkBridge plugin and enable Openplanet developer mode. In Openplanet, use **Developer > Load plugin**. Open a map before running examples that use `InputPlayer`.

```sh
bun run bridge:install
bun run visual --update
bun run visual
bun run visual --filter map-info
```

`--update` creates or replaces baselines. Review `test/visual/.out/report.html`; it shows baseline, actual, and diff images. `--filter` narrows the scenes. Visual tests capture the game renderer, so controls, fonts, layers, and shared state may behave differently from isolated XML fixtures. `for This` shared state is shared across layers and outlives them; tests should namespace keys and account for previously published values.

## Design mockups

`bun run design:diff [theme]` renders theme scenes headlessly and compares them with visual baselines. `bun run design:capture-glyphs` captures game glyphs for the canvas mockups; it requires the bridge plugin and an open map.

Source: `scripts/visual.ts`
