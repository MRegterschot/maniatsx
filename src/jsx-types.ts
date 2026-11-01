import type { IntrinsicElements as ManialinkElements } from "./intrinsics-overrides.ts";
import type { Component, Key, VNode } from "./vnode.ts";

// IntrinsicAttributes only applies to components, so intrinsics get key explicitly
type WithKey<T> = { [K in keyof T]: T[K] & { key?: Key } };

export namespace JSX {
  export type Element = VNode;
  export type ElementType = keyof IntrinsicElements | Component;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    key?: Key;
  }
  export interface IntrinsicElements extends WithKey<ManialinkElements> {}
}
