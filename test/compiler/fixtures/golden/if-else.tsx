import { client, type Integer, type Text } from "maniatsx/client";

client.onInit(() => {
  const score: Integer = 7;
  let label: Text = "";
  if (score > 10) {
    label = "high";
  } else if (score > 5 && score !== 6) {
    label = "mid";
  } else {
    label = "low";
  }
  console.log(label);
});
