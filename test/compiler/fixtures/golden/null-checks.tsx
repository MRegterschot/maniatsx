import { client, ml } from "maniatsx/client";
import { NullId, type CMlLabel } from "maniatsx/maniascript";

client.onInit(() => {
  const label = ml.Page!.GetFirstChild("x") as CMlLabel | null;
  if (label === null) {
    console.log("missing");
  }
  if (label !== null) {
    label.Value = "found";
  }
  const id = NullId;
  if (id === NullId) {
    console.log("no id");
  }
});
