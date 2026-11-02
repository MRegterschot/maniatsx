import { client, type Integer } from "maniatsx/client";

client.onInit(() => {
  const a: Integer = 2;
  const b: Integer = 6;
  let sum: Integer = 0;
  for (let i = a; i < b; i++) {
    sum += i;
  }
  for (let j = 0; j <= 3; j++) {
    sum += j;
  }
  console.log(sum);
});
