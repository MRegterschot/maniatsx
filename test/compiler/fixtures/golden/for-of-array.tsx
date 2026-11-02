import { client, type Integer } from "maniatsx/client";

client.onInit(() => {
  const values: Integer[] = [1, 2, 3];
  let sum: Integer = 0;
  for (const x of values) {
    sum += x;
  }
  console.log(sum);
});
