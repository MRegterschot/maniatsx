// Compiles client TS on import, so `bun run render` also works for components using maniatsx/client
import { maniatsxPlugin } from "../src/compiler/bun-plugin.ts";

Bun.plugin(maniatsxPlugin({ rootDir: process.cwd() }));
