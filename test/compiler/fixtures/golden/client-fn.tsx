import { client, type Integer, type Real, type Text } from "maniatsx/client";

const fact = client.fn((n: Integer): Integer => {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
});

const scale = client.fn((x: Real, by: Real): Real => x * by);

const greet = client.fn((who: Text, times: Integer): Text => {
  let out: Text = "";
  for (let i = 0; i < times; i++) {
    out += who;
  }
  return out;
});

client.onInit(() => {
  console.log(fact(5));
  console.log(scale(1.5, 2));
  console.log(greet("hi", 2));
});
