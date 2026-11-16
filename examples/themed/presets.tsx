import { override } from "maniatsx/theme";
import { kit, Panel } from "./kit.tsx";

export const defaultTheme = kit.base;
export const midnight = kit.defineTheme({
  id: "midnight",
  name: "Midnight",
  extends: defaultTheme,
  tokens: {
    color: { surface: "112", surfaceAlt: "223", accent: "8AF", text: "DDF", textMuted: "89A" },
  },
  text: { "map-info.icon": "◆" },
});
export const compact = kit.defineTheme({
  id: "compact",
  name: "Compact",
  extends: defaultTheme,
  layout: { "map-info": { anchor: "top-left", margin: [2, 2], scale: 0.8 } },
  components: [override(Panel, ({ Default, ...props }) => <Default {...props} variant="thin" />)],
});
