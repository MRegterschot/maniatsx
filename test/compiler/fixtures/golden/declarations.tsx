import { client, type Integer, type Real, type Text, type Boolean } from "maniatsx/client";

client.onInit(() => {
  const count: Integer = 3;
  let ratio: Real = 0.5;
  const name: Text = "hello";
  let flag: Boolean = true;
  ratio = 2;
  flag = !flag;
  console.log(name);
  console.log(count);
});
