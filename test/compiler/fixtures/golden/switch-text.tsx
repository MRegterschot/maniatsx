import { client, type Text } from "maniatsx/client";

client.onInit(() => {
  const mode: Text = "race";
  switch (mode) {
    case "race":
      console.log("racing");
      break;
    case "lobby":
      console.log("waiting");
      break;
    default:
      console.log("unknown");
  }
});
