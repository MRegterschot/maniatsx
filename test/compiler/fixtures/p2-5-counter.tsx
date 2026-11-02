import { action, client, type Integer } from "maniatsx/client";
const reset = action("counter-reset");
export function Counter(props: { title: string; start: Integer }) {
  const count = client.state<Integer>(props.start);
  return (
    <frame>
      <label text={props.title} />
      <label text={client.bind(() => "Clicks: " + count.value)} />
      <quad
        size={[20, 8]}
        onClick={client.handler(() => {
          count.value += 1;
        })}
      />
      <quad size={[20, 8]} onClick={client.handler(() => reset.trigger())} />
    </frame>
  );
}
