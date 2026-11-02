import { client, type Integer, type Text, type Boolean } from "maniatsx/client";

client.onInit(() => {
  const items: Integer[] = [4, 5, 6];
  items.push(7);
  const total: Integer = items.length;
  const has: Boolean = items.includes(5);
  const at: Integer = items.indexOf(6);
  items.splice(0, 1);
  const names: Text[] = ["a", "b"];
  names.push("c");
  const scores: Record<Text, Integer> = { a: 1, b: 2 };
  for (const k of Object.keys(scores)) {
    console.log(k);
  }
  console.log(total, has, at, names.length);
});
