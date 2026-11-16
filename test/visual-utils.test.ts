import { expect, test } from "bun:test";
import { addBackdrop, layoutSnapshot, treeDiff } from "../scripts/visual-utils.ts";

test("inserts backdrop before root children", () => {
  expect(addBackdrop('<manialink version="3"><label /></manialink>')).toBe(
    '<manialink version="3"><quad pos="-160 90" size="320 180" z-index="-100" bgcolor="111" /><label /></manialink>',
  );
});
test("reports paths for changed tree values", () => {
  expect(treeDiff({ children: [{ pos: [10, -2] }] }, { children: [{ pos: [12, -2] }] })).toEqual([
    "children[0].pos[0]: 10 → 12",
  ]);
});

test("layoutSnapshot drops the root frame and the backdrop", () => {
  const tree = { type: "frame", pos: [-1, -1], children: [{ type: "quad" }, { type: "frame" }] };
  expect(layoutSnapshot(tree)).toEqual([{ type: "frame" }]);
  expect(layoutSnapshot(null)).toBeNull();
});
