import { client, ml } from "maniatsx/client";
import type { CMlLabel, CMlQuad } from "maniatsx/maniascript";

client.onInit(() => {
  const label = ml.Page!.GetFirstChild("title") as CMlLabel;
  label.Value = "ready";
  (ml.Page!.GetFirstChild("bg") as CMlQuad).Visible = false;
});
