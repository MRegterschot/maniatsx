import { client } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";

const title = client.ref<CMlLabel>();

client.onInit(() => {
  title.control.Value = "ready";
});
const poke = client.handler(() => {
  title.control.Opacity = 0.5;
});
void poke;
