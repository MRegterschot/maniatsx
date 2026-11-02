import { Manialink, render } from "maniatsx";
import { Counter } from "./p2-5-counter.tsx";
export const xml = render(
  <Manialink id="counter">
    <Counter title="Hi" start={3} />
  </Manialink>,
);
