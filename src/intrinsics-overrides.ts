import type { ClientBinding, ClientHandler } from "./client/contract.ts";
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
type Events = {
  onClick?: ClientHandler;
  onRightClick?: ClientHandler;
  onMouseOver?: ClientHandler;
  onMouseOut?: ClientHandler;
};
type Bound<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | ClientBinding<NonNullable<T[P]>>;
};
type Controls<T extends { hidden?: unknown; pos?: unknown }> = Omit<Bound<T, "hidden">, "pos"> & {
  pos?: T["pos"] | ClientBinding<{ readonly X: number; readonly Y: number }>;
} & Events;
type EventBase = {
  [K in keyof Base]: Base[K] extends { id?: string } ? Base[K] & Events : Base[K];
};

// Only "ScoresTable" (shown with the scoreboard) is confirmed, via EvoSC's production templates
export type ManialinkLayer = "ScoresTable" | (string & {});

export interface IntrinsicElements extends Omit<
  EventBase,
  "label" | "quad" | "gauge" | "entry" | "textedit" | "fileentry" | "style" | "manialink"
> {
  // XSD lacks layer, which TM2020 controllers use
  manialink: Patch<Base["manialink"], { layer?: ManialinkLayer }>;
  include: { url: string; key?: string | number; children?: never };
  // XSD types linespacing as bool, the game takes a real; text may be a number (scores, times)
  label: Controls<
    Bound<
      FontPatch<
        Patch<
          Base["label"],
          { linespacing?: number; text?: string | number; textprefix?: string | number }
        >
      >,
      "text" | "opacity"
    >
  >;
  quad: Controls<Bound<Base["quad"], "opacity" | "image" | "bgcolor">>;
  gauge: Controls<Bound<Base["gauge"], "ratio">>;
  entry: Controls<Bound<FontPatch<Base["entry"]>, "default">> & { onSubmit?: ClientHandler };
  fileentry: FontPatch<Base["fileentry"]>;
  style: FontPatch<Base["style"]>;
  // XSD omits name (used by production templates); text children are not allowed
  textedit: Events & { onSubmit?: ClientHandler } & FontPatch<
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
