import { clientOnly } from "./client-only.ts";

export type Integer = number;
export type Real = number;
export type Text = string;
export type Boolean = boolean;
export type Void = void;
export type Ident = string & { readonly __ident: unique symbol };
export interface Vec2 {
  readonly X: Real;
  readonly Y: Real;
}
export interface Vec3 extends Vec2 {
  readonly Z: Real;
}
export interface Int2 {
  readonly X: Integer;
  readonly Y: Integer;
}
export interface Int3 extends Int2 {
  readonly Z: Integer;
}
export const vec2 = clientOnly<(x: Real, y: Real) => Vec2>("vec2");
export const vec3 = clientOnly<(x: Real, y: Real, z: Real) => Vec3>("vec3");
export const int2 = clientOnly<(x: Integer, y: Integer) => Int2>("int2");
export const int3 = clientOnly<(x: Integer, y: Integer, z: Integer) => Int3>("int3");
export const NullId = "NullId" as Ident;
