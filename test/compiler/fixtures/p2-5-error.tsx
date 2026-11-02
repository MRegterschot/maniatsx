import { client } from "maniatsx/client";
export const bad = client.handler(() => {
  throw new Error("bad");
});
