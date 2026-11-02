import { client, type Integer } from "maniatsx/client";

client.onInit(() => {
  let n: Integer = 0;
  while (n < 10) {
    n += 1;
    if (n === 3) {
      continue;
    }
    if (n === 8) {
      break;
    }
    console.log(n);
  }
});
