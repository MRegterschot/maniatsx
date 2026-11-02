import { client, type Integer, type Text } from "maniatsx/client";

client.onInit(() => {
  const n: Integer = 2;
  const t: Text = "two";
  console.log(t);
  console.log(n);
  console.log("n is", n);
  console.log();
});
