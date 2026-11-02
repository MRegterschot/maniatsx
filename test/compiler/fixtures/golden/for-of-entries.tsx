import { client, type Integer, type Text } from "maniatsx/client";

client.onInit(() => {
  const scores: Record<Text, Integer> = { alice: 3, bob: 5 };
  let total: Integer = 0;
  for (const [name, score] of Object.entries(scores)) {
    console.log(name);
    total += score;
  }
  console.log(total);
});
