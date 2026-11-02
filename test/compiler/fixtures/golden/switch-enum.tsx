import { client, ml } from "maniatsx/client";
import { CMlScriptEvent } from "maniatsx/maniascript";

client.onInit(() => {
  for (const event of ml.PendingEvents) {
    switch (event!.Type) {
      case CMlScriptEvent.Type.MouseClick:
        console.log("click");
        break;
      case CMlScriptEvent.Type.MouseOver:
        console.log("over");
        break;
      default:
        console.log("other");
    }
  }
});
