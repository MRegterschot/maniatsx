import { createThemeKit, slot } from "maniatsx/theme";
import type { Node, Vec2 } from "maniatsx";
import type { ClientRef } from "maniatsx/client";

export interface Tokens {
  color: { surface: string; surfaceAlt: string; accent: string; text: string; textMuted: string };
  font: { body: string; title: string };
  size: { sm: number; md: number; lg: number };
  opacity: { panel: number };
}

export const kit = createThemeKit<Tokens>({
  id: "default",
  name: "Default",
  tokens: {
    color: { surface: "222", surfaceAlt: "333", accent: "4CF", text: "FFF", textMuted: "AAA" },
    font: { body: "GameFont", title: "GameFontBold" },
    size: { sm: 1, md: 2, lg: 3 },
    opacity: { panel: 0.9 },
  },
  text: { "map-info.icon": "▣" },
});

export interface PanelProps {
  size: Vec2;
  children?: Node;
  variant?: "default" | "thin";
}
export const Panel = slot<PanelProps>(
  "ui/panel",
  function DefaultPanel({ size, children, variant }) {
    const t = kit.useTokens();
    return (
      <frame size={size}>
        <quad
          size={size}
          bgcolor={variant === "thin" ? t.color.surfaceAlt : t.color.surface}
          opacity={variant === "thin" ? 0.72 : t.opacity.panel}
        />
        <>{children}</>
      </frame>
    );
  },
);

export interface LabelProps {
  pos: Vec2;
  textsize: number;
  text?: string;
  style: "title" | "caption";
  ref?: ClientRef;
  halign?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
}
export const Label = slot<LabelProps>("ui/label", function DefaultLabel(props) {
  const t = kit.useTokens();
  return (
    <label
      pos={props.pos}
      text={props.text}
      textsize={props.textsize}
      textfont={props.style === "title" ? t.font.title : t.font.body}
      textcolor={props.style === "title" ? t.color.text : t.color.textMuted}
      halign={props.halign}
      valign={props.valign}
      ref={props.ref}
    />
  );
});
