import { describe, expect, test } from "bun:test";
import { renderMapInfo } from "../examples/themed/map-info.tsx";
import { compact, defaultTheme, midnight } from "../examples/themed/presets.tsx";
import { paper } from "../examples/themed/presets.tsx";
import { renderScene } from "../examples/themed/scene.tsx";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

// Goldens and XSD validation come from examples/index.ts; this covers what the themes may change
const markup = (xml: string) => xml.replace(/<script>[\s\S]*<\/script>/, "");
const script = (xml: string) => {
  const scripts = extractScripts(xml);
  expect(scripts).toHaveLength(1);
  expect(parseManiaScript(scripts[0]!).errors).toEqual([]);
  return scripts[0]!;
};

describe("themed map info example", () => {
  test("midnight changes only token colors and the icon text", () => {
    const neutral = (xml: string, colors: string[], icon: string) =>
      colors
        .reduce((out, color) => out.replaceAll(`"${color}"`, '"C"'), markup(xml))
        .replace(icon, "I");
    expect(neutral(renderMapInfo(midnight), ["112", "223", "DDF", "89A"], "\uF041")).toBe(
      neutral(renderMapInfo(defaultTheme), ["222", "333", "FFF", "AAA"], "\uF279"),
    );
  });

  test("compact moves the widget, scales it and uses its own skin", () => {
    const xml = renderMapInfo(compact);
    expect(xml).toContain('<frame pos="-158 88" scale="0.8">');
    expect(renderMapInfo(defaultTheme)).toContain('<frame pos="103 88">');
    // CompactView puts the author on the name's line; the panel override uses the thin variant
    expect(xml).toContain('<label pos="35 -4" size="18 4" text="Nadeo"');
    expect(xml).toContain('bgcolor="333" opacity="0.72"');
  });

  test("every skin keeps the same ManiaScript", () => {
    const [base, ...rest] = [defaultTheme, midnight, compact].map((t) => script(renderMapInfo(t)));
    for (const other of rest) expect(other).toBe(base!);
  });

  test("records uses the specified default and compact anchors", () => {
    expect(renderScene(defaultTheme)).toContain('<frame pos="103 76">');
    expect(renderScene(compact)).toContain('<frame pos="-158 78" scale="0.8">');
  });

  test("paper adds accent stripes to panels", () => {
    const xml = renderScene(paper);
    expect(xml.match(/size="0.6 [0-9.]+" bgcolor="F60"/g)).toHaveLength(4);
    expect(xml).toContain('text="Top times"');
  });

  test("all four scenes keep identical ManiaScript", () => {
    const scripts = [defaultTheme, midnight, compact, paper].map((theme) =>
      script(renderScene(theme)),
    );
    for (const other of scripts.slice(1)) expect(other).toBe(scripts[0]!);
  });
});
