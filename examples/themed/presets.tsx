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
  text: { "map-info.icon": "\uF041" },
});
export const compact = kit.defineTheme({
  id: "compact",
  name: "Compact",
  extends: defaultTheme,
  layout: {
    "map-info": { anchor: "top-left", margin: [2, 2], scale: 0.8 },
    records: { anchor: "top-left", margin: [2, 12], scale: 0.8 },
  },
  components: [override(Panel, ({ Default, ...props }) => <Default {...props} variant="thin" />)],
});

export const paper = kit.defineTheme({
  id: "paper",
  name: "Paper",
  extends: defaultTheme,
  tokens: {
    color: { surface: "EEE", surfaceAlt: "DDD", accent: "F60", text: "222", textMuted: "666" },
    opacity: { panel: 0.95 },
  },
  text: { "records.title": "Top times" },
  components: [
    override(Panel, ({ Default, ...props }) => {
      const t = kit.useTokens();
      return (
        <Default {...props}>
          <quad size={[0.6, props.size[1]]} bgcolor={t.color.accent} />
          {props.children}
        </Default>
      );
    }),
  ],
});
