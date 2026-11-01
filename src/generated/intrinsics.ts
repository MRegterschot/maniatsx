// Placeholder until scripts/gen-intrinsics.ts generates this file.
import type { Node } from "../vnode.ts";

export interface GeneratedIntrinsicElements {
  [tag: string]: { [attr: string]: unknown; children?: Node };
}
