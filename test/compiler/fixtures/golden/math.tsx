import { client, type Integer, type Real } from "maniatsx/client";

client.onInit(() => {
  const i: Integer = -4;
  const x: Real = 2.5;
  const a: Integer = Math.abs(i);
  const b: Real = Math.abs(x);
  const lo: Integer = Math.min(i, 3);
  const hi: Real = Math.max(x, 1.5);
  const f: Integer = Math.floor(x);
  const rd: Integer = Math.round(x);
  const c: Integer = Math.ceil(x);
  const sq: Real = Math.sqrt(x);
  const s: Real = Math.sin(x);
  const co: Real = Math.cos(x);
  const p: Real = Math.pow(x, 2);
  const pi: Real = Math.PI;
  console.log(a, b, lo, hi, f, rd, c, sq, s, co, p, pi);
});
