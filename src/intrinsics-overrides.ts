// Hand-maintained fixes on top of the generated XSD typings.
import type { GeneratedIntrinsicElements as Gen, LabelTextfont } from "./generated/intrinsics.ts";

// Replaces the listed keys of Base with those of Fix
type Patch<Base, Fix> = Omit<Base, keyof Fix> & Fix;

// Manialink v3 has no posn/sizen (v1/v2 leftovers in the XSD)
type DropLegacy<T> = { [K in keyof T]: Omit<T[K], "posn" | "sizen"> };

// Built-in fonts autocomplete, but custom font paths stay valid
export type TextFont = LabelTextfont | (string & {});
type FontPatch<T> = Patch<T, { textfont?: TextFont }>;

type Base = DropLegacy<Gen>;

export interface IntrinsicElements extends Omit<
  Base,
  "label" | "entry" | "textedit" | "fileentry" | "style"
> {
  // XSD types linespacing as bool, the game takes a real
  label: FontPatch<Patch<Base["label"], { linespacing?: number }>>;
  entry: FontPatch<Base["entry"]>;
  fileentry: FontPatch<Base["fileentry"]>;
  style: FontPatch<Base["style"]>;
  // XSD omits name (used by production templates); text children are not allowed
  textedit: FontPatch<
    Patch<
      Base["textedit"],
      {
        /** Name of the textedit, used to identify it for the server */
        name?: string;
        children?: never;
      }
    >
  >;
}
