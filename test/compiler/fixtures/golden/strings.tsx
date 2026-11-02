import { client, type Integer, type Real, type Text } from "maniatsx/client";

client.onInit(() => {
  const name: Text = "world";
  const n: Integer = 3;
  const r: Real = 1.5;
  const a: Text = "hello " + name;
  const b: Text = "n=" + n + ", r=" + r;
  const c: Text = `hi ${name}, you have ${n} items at ${r}`;
  const d: Text = `${n}`;
  const e: Text = n + " items";
  console.log(a, b, c, d, e);
});
