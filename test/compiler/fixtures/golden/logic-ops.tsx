import { client, type Integer, type Boolean, type Text } from "maniatsx/client";

client.onInit(() => {
  const a: Integer = 1;
  const b: Integer = 2;
  const t: Text = "x";
  const p: Boolean = a === b;
  const q: Boolean = a !== b;
  const r: Boolean = (a < b && t === "x") || !(a >= b);
  const s: Boolean = !p && (q || r);
  const u: Boolean = a === 1 && (b === 2 || t !== "y");
  console.log(p, q, r, s, u);
});
