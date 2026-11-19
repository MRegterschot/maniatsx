import { describe, expect, test } from "bun:test";
import { QuarterCircle, render } from "../src/index.ts";
import type { Quadrant } from "../src/index.ts";

const BRUSH = "file:///Media/Painter/Stencils/01-EllipseRound/Brush.tga";

describe("QuarterCircle", () => {
  test.each<[Quadrant, string]>([
    ["TopLeft", "0 0"],
    ["TopRight", "-2 0"],
    ["BottomLeft", "0 2"],
    ["BottomRight", "-2 2"],
  ])("offsets the circle for %s", (quadrant, offset) => {
    expect(render(<QuarterCircle radius={2} quadrant={quadrant} color="F00" />)).toBe(
      `<frame pos="0 0" size="2 2"><quad pos="${offset}" size="4 4" image="${BRUSH}" modulatecolor="F00" opacity="1" scriptevents="0" /></frame>`,
    );
  });

  test("passes position, id and interaction props through", () => {
    expect(
      render(
        <QuarterCircle
          radius={1.5}
          quadrant="TopLeft"
          color="000"
          pos={[10, -5]}
          opacity={0.5}
          id="corner"
          action="click"
          scriptevents
        />,
      ),
    ).toBe(
      `<frame pos="10 -5" size="1.5 1.5" id="corner"><quad pos="0 0" size="3 3" image="${BRUSH}" modulatecolor="000" opacity="0.5" action="click" scriptevents="1" /></frame>`,
    );
  });

  test("rejects a non-positive radius and unknown quadrants", () => {
    expect(() => render(<QuarterCircle radius={0} quadrant="TopLeft" color="000" />)).toThrow(
      /radius/,
    );
    expect(() =>
      render(<QuarterCircle radius={1} quadrant={"Middle" as Quadrant} color="000" />),
    ).toThrow(/Middle/);
  });
});
