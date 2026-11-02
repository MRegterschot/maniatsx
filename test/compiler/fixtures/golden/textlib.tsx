import { client, type Integer, type Text } from "maniatsx/client";
import { TextLib } from "maniatsx/maniascript";

client.onInit(() => {
  const s: Text = "hello";
  const up: Text = TextLib.ToUpperCase(s);
  const len: Integer = TextLib.Length(up);
  console.log(up, len);
});
