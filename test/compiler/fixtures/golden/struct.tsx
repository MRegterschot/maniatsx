import { client, type Integer, type Text } from "maniatsx/client";

interface Entry {
  count: Integer;
  name: Text;
}

client.onInit(() => {
  const e: Entry = { count: 1, name: "x" };
  const list: Entry[] = [e, { count: 2, name: "y" }];
  list.push({ count: 3, name: "z" });
  console.log(e.count, e.name, list.length);
});
