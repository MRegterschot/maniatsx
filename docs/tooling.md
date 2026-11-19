---
title: Tooling
description: Choose a package entry point and compile client TypeScript with Bun, esbuild, or the CLI.
sidebar:
  order: 8
---

# Tooling

## Package exports

| Import                                              | Purpose                                               |
| --------------------------------------------------- | ----------------------------------------------------- |
| `maniatsx`                                          | Renderer, components, context, and script composition |
| `maniatsx/jsx-runtime` / `maniatsx/jsx-dev-runtime` | Automatic JSX runtime                                 |
| `maniatsx/client`                                   | Client authoring API and ManiaScript types            |
| `maniatsx/maniascript`                              | ManiaScript API types and client-only values          |
| `maniatsx/theme`                                    | Theme kit, slots, and anchored layout                 |
| `maniatsx/bun-plugin`                               | Bun build transform                                   |
| `maniatsx/esbuild-plugin`                           | esbuild transform                                     |

The package has no runtime dependencies. TypeScript compiler dependencies are used at build time.

## Bun plugin

For direct Bun execution, register `maniatsxPlugin()` through a preload file. For a bundle, pass it in `Bun.build({ plugins: [...] })`. The plugin uses the working directory as its compiler root; configure `rootDir` or `tsconfigPath` when the project root differs.

Pass `keyPrefix` to `maniatsxPlugin({ keyPrefix: "plugin_name" })` to namespace shared and persisted client storage keys.

## esbuild plugin

Use `maniatsxEsbuildPlugin()` when compiling a bundle with esbuild, including plugin bundles built outside Bun. It applies the client transform to project TypeScript before the bundle is evaluated.

Pass `keyPrefix` to `maniatsxEsbuildPlugin({ keyPrefix: "plugin_name" })` for the same storage namespace.

## `maniatsx` render CLI

`maniatsx` renders a module's export to XML. Both CLIs run on Node 22.15 or later, or on Bun; on Node, `.ts` and `.tsx` modules are transpiled on import and client code is compiled like the bundler plugins do:

```sh
maniatsx ui/page.tsx --props '{"title":"Hello"}' --pretty --out page.xml
```

## `maniatsx compile`

The `maniatsx compile` CLI compiles a project using its tsconfig. The installed bin is named `maniatsx-compile`:

```sh
maniatsx-compile --project tsconfig.json --out compiled
maniatsx-compile --project tsconfig.json --out compiled --check
maniatsx-compile --project tsconfig.json --out compiled --key-prefix plugin_name
```

`--check` reports diagnostics without writing; `--all` also copies untouched project files. See `maniatsx-compile --help` for CLI options.

## QuickJS and sandboxing

The renderer is plain ES2022 with no runtime package dependencies, which allows it to run in QuickJS. The M6 smoke test bundled a themed widget to 47,108 bytes; evaluation took 14.35 ms, and three preset renders took 3.67 ms, 1.51 ms, and 1.24 ms (default, midnight, compact). These are measurements of that test bundle, not runtime limits. Host functions cannot cross the QuickJS boundary; pass theme and render data as serialisable values.

## Vendoring

The gocontrolpanel repository vendors this project as `packages/maniatsx`. Its sync script updates the vendored package and records the upstream source commit in `VENDORED.json`. Use that script rather than copying files by hand so the recorded revision stays accurate.

Source: `package.json`
