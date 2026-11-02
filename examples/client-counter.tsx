// In-game smoke test for phase 2: client state, a binding, click handlers and a server action.
import { Manialink } from "../src/index.ts";
import { action, client, type Integer } from "maniatsx/client";
import { TextLib } from "maniatsx/maniascript";

const reset = action("maniatsx-demo-reset");

export default function ClientCounterDemo(props: { start?: Integer }) {
  const count = client.state<Integer>(props.start ?? 0);
  const open = client.state<boolean>(true);
  return (
    <Manialink id="maniatsx-demo" name="maniatsx:demo">
      <frame pos={[-30, 40]}>
        <quad size={[60, 26]} bgcolor="000000cc" />
        <label pos={[2, -3]} text="maniatsx client demo" textsize={2} textcolor="ffffff" />
        <label pos={[2, -9]} text={client.bind(() => "Clicks: " + count.value)} textsize={2} />
        <label
          pos={[2, -14]}
          hidden={client.bind(() => !open.value)}
          text="Toggle me"
          textcolor="ffcc00"
        />
        <label
          pos={[2, -20]}
          size={[17, 5]}
          text="+1"
          focusareacolor1="333"
          focusareacolor2="555"
          onClick={client.handler(() => {
            count.value += 1;
          })}
        />
        <label
          pos={[21, -20]}
          size={[17, 5]}
          text="Toggle"
          focusareacolor1="333"
          focusareacolor2="555"
          onClick={client.handler(() => {
            open.value = !open.value;
          })}
        />
        <label
          pos={[40, -20]}
          size={[17, 5]}
          text="Reset"
          focusareacolor1="333"
          focusareacolor2="555"
          onClick={client.handler(() => reset.trigger(TextLib.ToText(count.value)))}
        />
      </frame>
    </Manialink>
  );
}
