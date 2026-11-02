import { client, ml } from "maniatsx/client";
import { CMlScriptEvent } from "maniatsx/maniascript";

client.onFrame(() => {
  for (const event of ml.PendingEvents) {
    if (event!.Type === CMlScriptEvent.Type.MouseClick) {
      console.log(event!.ControlId);
    } else if (event!.Type !== CMlScriptEvent.Type.MouseOver) {
      console.log("other");
    }
  }
});
