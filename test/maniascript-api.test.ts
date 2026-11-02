import { expect, test } from "bun:test";
import * as api from "../src/maniascript/index.ts";
import { generate } from "../scripts/gen-maniascript-api.ts";
import type {
  CMlLabel,
  CMlFrame,
  CMlControl,
  CMlScriptIngame,
  CMlScriptEvent,
  Text,
  Real,
} from "../src/maniascript/index.ts";
import type { TextLib } from "../src/maniascript/index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Checks = [
  Assert<Equal<CMlLabel["Value"], Text>>,
  Assert<Equal<typeof CMlScriptEvent.Type.MouseClick, "CMlScriptEvent::Type::MouseClick">>,
  Assert<Equal<ReturnType<typeof TextLib.ToReal>, Real>>,
  Assert<
    Equal<CMlScriptEvent.Type, (typeof CMlScriptEvent.Type)[keyof typeof CMlScriptEvent.Type]>
  >,
  Assert<CMlFrame extends CMlControl ? true : false>,
  Assert<"Page" extends keyof CMlScriptIngame ? true : false>,
  Assert<"PendingEvents" extends keyof CMlScriptIngame ? true : false>,
];
const checks: Checks = [true, true, true, true, true, true, true];

test("API generation is deterministic and current", async () => {
  const input = await Bun.file("vendor/maniascript/doc.h").text();
  const first = await generate(input);
  expect(await generate(input)).toBe(first);
  expect(await Bun.file("src/maniascript/api.generated.ts").text()).toBe(first);
  expect(checks).toHaveLength(7);
}, 30000);

test("runtime exports are linkable and client-only", async () => {
  const generated = await Bun.file("src/maniascript/api.generated.ts").text();
  const names = [...generated.matchAll(/^export const (\w+)/gm)].map((match) => match[1]!);
  for (const name of [...names, "vec2", "vec3", "int2", "int3", "NullId"]) {
    expect(name in api).toBe(true);
  }
  expect(api.CMlScriptEvent.Type.MouseClick).toBe("CMlScriptEvent::Type::MouseClick");
  expect(Object.isFrozen(api.CMlScriptEvent)).toBe(true);
  expect(Object.isFrozen(api.CMlScriptEvent.Type)).toBe(true);
  expect(() => api.TextLib.ToReal("1")).toThrow(
    "TextLib.ToReal is client-only: use it inside maniatsx client code",
  );
  expect(() => api.vec2(1, 2)).toThrow("vec2 is client-only: use it inside maniatsx client code");
  expect(() => String(api.TextLib)).not.toThrow();
  expect((await import("../src/maniascript/index.ts")).TextLib).toBe(api.TextLib);
});
