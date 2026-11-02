import { client, ml, type Integer, type Real } from "maniatsx/client";
import { vec2, int2, type CMlLabel } from "maniatsx/maniascript";

client.onInit(() => {
  const x: Real = 3;
  const n: Integer = 4;
  const label = ml.Page!.GetFirstChild("l") as CMlLabel;
  label.RelativePosition_V3 = vec2(1, 2);
  const size = vec2(x, 2.5);
  const cell = int2(1, n);
  console.log(size.X, cell.Y);
});
