import { client, ml } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";

client.onInit(() => {
  const label = ml.Page!.GetFirstChild("name") as CMlLabel;
  label.Value = ml.LocalUser!.Name;
});
