import type { IntrinsicElements as ManialinkElements } from "./intrinsics-overrides.ts";
import type { Component, Key, VNode } from "./vnode.ts";

export namespace JSX {
  export type Element = VNode;
  export type ElementType = keyof IntrinsicElements | Component;
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    key?: Key;
  }
  export interface IntrinsicElements extends ManialinkElements {}
}
