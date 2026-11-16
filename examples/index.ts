import type { RenderOptions } from "maniatsx";
import { renderActionGroup } from "./action-group.tsx";
import { renderSharedData, renderSharedDataUpdate } from "./shared-data.tsx";
import { renderWidget } from "./widget.tsx";
import { renderWindow } from "./window.tsx";

import { renderMapInfo } from "./themed/map-info.tsx";
import { compact, defaultTheme, midnight } from "./themed/presets.tsx";

// Name -> renderer; the golden files in test/golden are named after the keys.
export const examples: Record<string, (options?: RenderOptions) => string> = {
  "action-group": renderActionGroup,
  "shared-data": renderSharedData,
  "shared-data-update": renderSharedDataUpdate,
  widget: renderWidget,
  window: renderWindow,
  "themed-default": (options) => renderMapInfo(defaultTheme, options),
  "themed-midnight": (options) => renderMapInfo(midnight, options),
  "themed-compact": (options) => renderMapInfo(compact, options),
};
