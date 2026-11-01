import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function cli(...args: string[]) {
  const process = Bun.spawn(["bun", "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return { stdout, stderr, code };
}

const fixture = "test/fixtures/cli.tsx";

test("renders the default component with props and pretty formatting", async () => {
  const result = await cli(fixture, "--props", '{"title":"Hello"}', "--pretty");
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('text="Hello"');
  expect(result.stdout).toContain("\n  <label");
  expect(result.stderr).toMatch(/Output: \d+ bytes/);
});

test("renders a named VNode to a file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "maniatsx-cli-"));
  try {
    const path = join(dir, "output.xml");
    const result = await cli(fixture, "--export", "node", "--out", path);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(await readFile(path, "utf8")).toContain('id="named"');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("renders an example function that returns XML", async () => {
  const result = await cli("examples/window.tsx", "--export", "renderWindow");
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('id="example-window"');
});

test("reports missing exports and invalid props", async () => {
  const missing = await cli(fixture, "--export", "missing");
  expect(missing.code).toBe(1);
  expect(missing.stderr).toContain("Available exports: default, node");
  const invalid = await cli(fixture, "--props", "{");
  expect(invalid.code).toBe(1);
  expect(invalid.stderr).toContain("--props must be a valid JSON object");
});
