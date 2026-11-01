import { Manialink, Script, type Node } from "maniatsx";

export interface PageProps {
  id: string;
  children?: Node;
}

// Port of manialink.hbs: the shared page shell (name, includes, control-less event guard).
export function Page(props: PageProps) {
  return (
    <Manialink id={props.id} name={`TMCP:${props.id}`}>
      <Script.Include lib="MathLib" as="ML" />
      <Script.Include lib="TextLib" as="TL" />
      <Script.Include lib="TimeLib" as="TimeLib" />
      <Script.Include lib="ColorLib" as="CL" />
      {/* First in tree order, so it guards every Events part below */}
      <Script.Events id="skip-controlless-events">
        {"if (Event.Control == Null) continue;"}
      </Script.Events>
      {props.children}
    </Manialink>
  );
}
