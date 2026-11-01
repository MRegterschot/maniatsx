import type { RenderOptions } from "maniatsx";
import { renderActionGroup } from "./action-group.tsx";
import { renderWidget } from "./widget.tsx";
import { renderWindow } from "./window.tsx";

// Name -> renderer; the golden files in test/golden are named after the keys.
export const examples: Record<string, (options?: RenderOptions) => string> = {
  "action-group": renderActionGroup,
  widget: renderWidget,
  window: renderWindow,
};
