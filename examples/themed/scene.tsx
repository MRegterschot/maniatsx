import { Manialink, render, type RenderOptions } from "maniatsx";
import { kit } from "./kit.tsx";
import { MapInfo } from "./map-info.tsx";
import { Records } from "./records.tsx";
import { defaultTheme } from "./presets.tsx";

export function renderScene(
  theme: typeof defaultTheme = defaultTheme,
  options?: RenderOptions,
): string {
  return render(
    <kit.ThemeProvider theme={theme}>
      <Manialink id="themed-scene">
        <MapInfo name="A01 - Green Plains" author="Nadeo" />
        <Records />
      </Manialink>
    </kit.ThemeProvider>,
    options,
  );
}
