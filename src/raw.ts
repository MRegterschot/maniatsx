import { RAW_XML, type RawXml } from "./vnode.ts";

// Trusted XML inserted verbatim; never pass player-controlled text.
export function raw(xml: string): RawXml {
  if (typeof xml !== "string") throw new TypeError("raw() expects a string");
  return Object.freeze({ $$typeof: RAW_XML, xml });
}
