import { Fragment, VNODE, type Key, type VNode } from "./vnode.ts";

export { Fragment };
export type { JSX } from "./jsx-types.ts";

export function jsx(type: VNode["type"], props: Record<string, unknown>, key?: Key): VNode {
  return Object.freeze({ $$typeof: VNODE, type, props, key: key ?? null });
}

export const jsxs = jsx;
