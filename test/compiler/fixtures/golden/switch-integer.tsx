import { client, type Integer } from "maniatsx/client";

client.onInit(() => {
  const level: Integer = 2;
  switch (level) {
    case 1:
      console.log("one");
      break;
    case 2:
      console.log("two");
      break;
    default:
      console.log("many");
  }
});
