import { createContext } from "maniatsx";

// Same shape as ManialinkTheme in gocontrolpanel: three-digit hex colors without "#"
export interface ThemePalette {
  foreground: string;
  background: string;
  foregroundMuted: string;
  backgroundMuted: string;
}

// Quads read their colors from `quad`, labels from `label`
export interface ManialinkTheme {
  quad: ThemePalette;
  label: ThemePalette;
}

const DEFAULT_PALETTE: ThemePalette = {
  foreground: "DDD",
  background: "222",
  foregroundMuted: "CCC",
  backgroundMuted: "333",
};

export const DEFAULT_THEME: ManialinkTheme = { quad: DEFAULT_PALETTE, label: DEFAULT_PALETTE };

export const Theme = createContext<ManialinkTheme>(DEFAULT_THEME);
