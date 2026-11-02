import { client, type Integer } from "maniatsx/client";

export const clamp = client.fn((value: Integer, max: Integer): Integer => {
  if (value > max) {
    return max;
  }
  return value;
});

client.onInit(() => {
  console.log(clamp(12, 10));
});
