// Core node contracts shared by the runtime, renderer and typings.

export const VNODE = Symbol.for("maniatsx.vnode");
export const Fragment = Symbol.for("maniatsx.fragment");
export const MS_CODE = Symbol.for("maniatsx.ms");
export const RAW_XML = Symbol.for("maniatsx.raw");

export type Key = string | number;

export type Component<P = any> = (props: P) => Node;

export interface VNode {
  readonly $$typeof: typeof VNODE;
  readonly type: string | Component | typeof Fragment;
  readonly props: Readonly<Record<string, unknown>>;
  readonly key: Key | null;
}

// Trusted XML inserted verbatim, created by raw()
export interface RawXml {
  readonly $$typeof: typeof RAW_XML;
  readonly xml: string;
}

// ManiaScript source, created by the ms tagged template
export interface MsCode {
  readonly $$typeof: typeof MS_CODE;
  readonly code: string;
}

export type Node = VNode | RawXml | string | number | boolean | null | undefined | readonly Node[];

// Attribute value types used by the intrinsic element typings
export type Vec2 = readonly [number, number];
export type Color = string;
