import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { Manialink, Script } from "../src/manialink.tsx";
import { ms } from "../src/ms.ts";
import { render } from "../src/render.ts";
import { extractScripts, parseManiaScript } from "./support/maniascript.ts";

function check(xml: string) {
  const scripts = extractScripts(xml);
  expect(scripts).toHaveLength(1);
  expect(parseManiaScript(scripts[0]!).errors).toEqual([]);
}

describe("ManiaScript syntax", () => {
  const golden = new URL("./golden/", import.meta.url);
  for (const name of readdirSync(golden).filter((name) => name.endsWith(".xml"))) {
    test(`golden ${name}`, () => check(readFileSync(new URL(name, golden), "utf8")));
  }

  for (const events of [true, false]) {
    test(`all script slots ${events ? "with" : "without"} events`, () => {
      check(
        render(
          <Manialink id="slots">
            <Script.Include lib="TextLib" as="TL" />
            <Script.Globals>{ms`declare Integer Count;`}</Script.Globals>
            <Script.Functions>{ms`Void Increment() { Count += 1; }`}</Script.Functions>
            <Script.Main>{ms`Count = 0;`}</Script.Main>
            {events && (
              <Script.Events>{ms`if (Event.Type == CMlScriptEvent::Type::MouseClick) { Increment(); }`}</Script.Events>
            )}
            <Script.Loop>{ms`Increment();`}</Script.Loop>
          </Manialink>,
        ),
      );
    });
  }

  test("includes and globals alone", () => {
    check(
      render(
        <Manialink id="globals">
          <Script.Include lib="TextLib" as="TL" />
          <Script.Globals>{ms`declare Integer Count;`}</Script.Globals>
        </Manialink>,
      ),
    );
  });

  test("interpolated literals in statements", () => {
    const code = ms`
      declare Integer I = ${42};
      declare Real R = ${ms.real(1)};
      declare Text T = ${'quote " newline\n slash \\'};
      declare Text Split = ${"a--b"};
      declare Boolean Yes = ${true};
      declare Boolean No = ${false};
      declare Vec2 V = ${ms.vec2(1, 2.5)};
      declare Integer[] Values = ${[1, 2, 3]};
    `;
    expect(code.code).toContain('"a-" ^ "-b"');
    check(
      render(
        <Manialink id="literals">
          <Script.Main>{code}</Script.Main>
        </Manialink>,
      ),
    );
  });

  test("reports broken syntax", () => {
    expect(parseManiaScript("main() { declare Integer X = ; }").errors.length).toBeGreaterThan(0);
  });

  test("extracts each script independently", () => {
    expect(extractScripts("<script><!--one--></script><script><!--two--></script>")).toEqual([
      "one",
      "two",
    ]);
  });
});
