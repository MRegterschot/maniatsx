import { client, ml, type Integer, type Real, type Text } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";

client.onInit(() => {
  const n: Integer = 5;
  const big: Integer = n > 3 ? 10 : 1;
  const half: Real = n > 3 ? 0.5 : 1.5;
  const word: Text = n === 5 ? "five" : "other";
  const label = ml.Page!.GetFirstChild("a") as CMlLabel;
  const other = ml.Page!.GetFirstChild("b") as CMlLabel;
  const picked: CMlLabel = n > 3 ? label : other;
  picked.Value = word;
  console.log(n > 3 ? n : big);
  console.log(half);
});
