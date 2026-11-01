import { jsx } from "./jsx-runtime.ts";
import type { Key, VNode } from "./vnode.ts";

export { Fragment, jsx, jsxs } from "./jsx-runtime.ts";
export type { JSX } from "./jsx-runtime.ts";

// Dev-only args (isStatic, source, self) are ignored.
export function jsxDEV(
  type: VNode["type"],
  props: Record<string, unknown>,
  key?: Key,
  _isStatic?: boolean,
  _source?: unknown,
  _self?: unknown,
): VNode {
  return jsx(type, props, key);
}
