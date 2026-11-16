// Data-driven widget: a main page plus a small update page that re-sends only the data.
import { Manialink, render, type RenderOptions } from "../src/index.ts";
import { client, Publish, type Integer } from "maniatsx/client";

export interface MapSummary {
  name: string;
  author: string;
  seconds: Integer;
}

// Imported by both pages, so they agree on the key and the type by construction
export const mapSummary = client.shared<MapSummary>("example_map_summary", {
  name: "",
  author: "",
  seconds: 0,
});

// client.watch registers into the page, so it runs inside <Manialink>
function MapSummaryView() {
  const updates = client.state<Integer>(0);
  client.watch(mapSummary, () => {
    updates.value += 1;
  });
  return (
    <frame pos={[-160, 80]}>
      <quad size={[50, 14]} bgcolor="000000cc" />
      <label pos={[2, -2]} textsize={2} text={client.bind(() => mapSummary.value.name)} />
      <label
        pos={[2, -6]}
        textsize={1}
        text={client.bind(() => `by ${mapSummary.value.author}, ${mapSummary.value.seconds}s`)}
      />
      <label pos={[2, -10]} textsize={1} text={client.bind(() => `updates: ${updates.value}`)} />
    </frame>
  );
}

export const MapSummaryWidget = () => (
  <Manialink id="shared-data">
    <MapSummaryView />
  </Manialink>
);

// Only this page is re-sent when the map changes
export function MapSummaryUpdate(props: { data: MapSummary }) {
  return (
    <Manialink id="shared-data-update">
      <Publish to={mapSummary} value={props.data} />
    </Manialink>
  );
}

export const renderSharedData = (options?: RenderOptions) => render(<MapSummaryWidget />, options);

export const renderSharedDataUpdate = (options?: RenderOptions) =>
  render(
    <MapSummaryUpdate data={{ name: "A01 - Green Plains", author: "Nadeo", seconds: 25 }} />,
    options,
  );
