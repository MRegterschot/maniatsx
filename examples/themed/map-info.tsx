import { Manialink, render, type RenderOptions } from "maniatsx";
import { client, type ClientRef } from "maniatsx/client";
import type { CMlLabel } from "maniatsx/maniascript";
import { Anchored, slot } from "maniatsx/theme";
import { kit, Label, Panel } from "./kit.tsx";
import { compact, defaultTheme, midnight } from "./presets.tsx";

interface ViewProps {
  name: string;
  author: string;
  nameRef: ClientRef<CMlLabel>;
  authorRef: ClientRef<CMlLabel>;
  icon: string;
}
function DefaultView({ name, author, nameRef, authorRef, icon }: ViewProps) {
  return (
    <Panel size={[55, 10]}>
      <Label pos={[2, -2]} size={[6, 6]} textsize={3} text={icon} style="title" />
      <Label pos={[10, -2]} size={[43, 5]} textsize={3} text={name} style="title" ref={nameRef} />
      <Label
        pos={[10, -6]}
        size={[43, 4]}
        textsize={1}
        text={author}
        style="caption"
        ref={authorRef}
      />
    </Panel>
  );
}
function CompactView({ name, author, nameRef, authorRef, icon }: ViewProps) {
  return (
    <Panel size={[55, 10]}>
      <Label pos={[2, -4]} size={[5, 5]} textsize={2} text={icon} style="title" />
      <Label pos={[8, -4]} size={[25, 5]} textsize={2} text={name} style="title" ref={nameRef} />
      <Label
        pos={[35, -4]}
        size={[18, 4]}
        textsize={1}
        text={author}
        style="caption"
        ref={authorRef}
      />
    </Panel>
  );
}
const View = slot<ViewProps>("map-info/view", DefaultView, { compact: CompactView });

export function MapInfo({ name, author }: { name: string; author: string }) {
  const nameRef = client.ref<CMlLabel>();
  const authorRef = client.ref<CMlLabel>();
  client.onInit(() => {
    nameRef.control.Value = name;
    authorRef.control.Value = author;
  });
  return (
    <Anchored name="map-info" layout={{ anchor: "top-right", margin: [2, 2], size: [55, 10] }}>
      <View
        name={name}
        author={author}
        nameRef={nameRef}
        authorRef={authorRef}
        icon={kit.useText("map-info.icon")}
      />
    </Anchored>
  );
}

export function renderMapInfo(
  theme: typeof defaultTheme = defaultTheme,
  options?: RenderOptions,
): string {
  return render(
    <kit.ThemeProvider theme={theme}>
      <Manialink id="map-info">
        <MapInfo name="A01 - Green Plains" author="Nadeo" />
      </Manialink>
    </kit.ThemeProvider>,
    options,
  );
}
export const themedPresets = { default: defaultTheme, midnight, compact };
