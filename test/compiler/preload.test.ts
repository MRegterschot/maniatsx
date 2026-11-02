import { expect, test } from "bun:test";

// The runtime plugin path (Bun.plugin in a preload) differs from Bun.build: untouched files must still return contents
test("render CLI compiles client components through the preload", async () => {
  const proc = Bun.spawn(["bun", "run", "render", "examples/client-counter.tsx"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(err).not.toContain("error");
  expect(code).toBe(0);
  expect(out).toContain(
    'TriggerPageAction("maniatsx-demo-reset" ^ "|" ^ TextLib::ToText(Mtx_S1));',
  );
}, 30_000);
