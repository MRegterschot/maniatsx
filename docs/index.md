---
title: maniatsx
description: Write Trackmania Manialinks in typed TSX and render them to Manialink v3 XML.
sidebar:
  order: 1
---

# maniatsx

maniatsx renders typed TSX pages as Manialink v3 XML. It also compiles a restricted set of client TypeScript to ManiaScript at build time. Client compilation is experimental.

The project has two halves:

- **TSX to XML:** JSX builds a tree; `render()` serialises it. Components, context, themes, and hand-written ManiaScript composition run on the server.
- **Client TypeScript to ManiaScript:** calls such as `client.state`, `client.handler`, and `client.bind` are transformed during the build. Their code runs in the game.

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

## Guides

- [Getting started](getting-started.md)
- [Components](components.md)
- [Client code](client-code.md)
- [Theming](theming.md)
- [Testing](testing.md)
- [Game behaviour reference](game-behaviour.md)
- [Tooling](tooling.md)
