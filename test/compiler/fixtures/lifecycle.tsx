import { client, ml, type Integer } from "maniatsx/client";
import { CMlScriptEvent, TextLib, type CMlLabel } from "maniatsx/maniascript";

const upper = client.fn((text: string): string => TextLib.ToUpperCase(text));
export function Lifecycle() {
  const hidden = client.state<boolean>(false);
  client.onInit(() => {
    const label = ml.Page!.GetFirstChild("status") as CMlLabel;
    label.Value = upper("ready");
  });
  client.onFrame(() => {
    const values: Integer[] = [1, 2];
    for (const value of values) {
      if (value === 2 && CMlScriptEvent.Type.MouseClick === CMlScriptEvent.Type.MouseClick) {
        hidden.value = true;
      }
    }
  });
  return <label id="status" hidden={client.bind(() => hidden.value)} />;
}
