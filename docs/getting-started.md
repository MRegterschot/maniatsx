---
title: Getting started
description: Install maniatsx, configure TSX, render a page, and send it to a server.
sidebar:
  order: 2
---

# Getting started

## Install

The package is not published to npm. Build it and depend on the local package path so imports resolve from `dist/`:

```sh
bun run build
```

## Configure TSX

Set the automatic JSX runtime and import source in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "maniatsx"
  }
}
```

When a project also uses React, retain its project-wide JSX setup and opt individual files in with `/** @jsxImportSource maniatsx */`. The JSX mode must be `react-jsx` or `react-jsxdev`.

## Render a page

```tsx
import { Manialink, render } from "maniatsx";

const xml = render(
  <Manialink id="hello" name="TMCP:hello">
    <label text="Hello, Trackmania!" textsize={2} />
  </Manialink>,
);
```

`render()` returns XML with a prolog by default. Pass `{ pretty: true }` for indented output. `<Manialink prolog={false}>` omits the prolog. See [render options](components.md#render-options).

## Send a page

Use `bun run send` to send a rendered XML file to a dedicated server. It defaults to localhost port `5010` with the `SuperAdmin` login; override connection settings on the command line:

```sh
bun run send page.xml --host 127.0.0.1 --port 5010 --user SuperAdmin --password SuperAdmin
```

Add `--login <player>` to send it to one player. The process stays connected and prints page actions; Ctrl+C hides the page and exits. Run `bun run send -- --help` for usage.

## Compile client code

When a page imports client authoring APIs, register the Bun plugin in a preload file:

```ts
import { maniatsxPlugin } from "maniatsx/bun-plugin";
Bun.plugin(maniatsxPlugin());
```

Run Bun with `bun --preload ./preload.ts app.tsx`. Bundles can instead pass `maniatsxPlugin()` to `Bun.build`. The [tooling guide](tooling.md) covers the compiler CLI and esbuild plugin.
