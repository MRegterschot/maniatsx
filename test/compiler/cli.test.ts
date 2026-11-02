import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repo = process.cwd();
const cli = path.join(repo, "bin/maniatsx-compile.ts");

test("CLI writes transformed files, optionally copies others, and checks without writing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "maniatsx-p2-5-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          jsx: "react-jsx",
          jsxImportSource: "maniatsx",
          paths: {
            "maniatsx/client": [path.join(repo, "src/client/index.ts")],
            "maniatsx/jsx-runtime": [path.join(repo, "src/jsx-runtime.ts")],
          },
        },
        include: ["src"],
      }),
    );
    const counter = await readFile(
      path.join(repo, "test/compiler/fixtures/p2-5-counter.tsx"),
      "utf8",
    );
    await writeFile(path.join(dir, "src/counter.tsx"), counter);
    await writeFile(path.join(dir, "src/plain.ts"), "export const plain = 1;\n");
    const run = async (...args: string[]) => {
      const proc = Bun.spawn(
        [
          "bun",
          cli,
          "--project",
          path.join(dir, "tsconfig.json"),
          "--out",
          path.join(dir, "out"),
          ...args,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      return {
        stdout: await new Response(proc.stdout).text(),
        stderr: await new Response(proc.stderr).text(),
        exit: await proc.exited,
      };
    };
    expect((await run("--check")).exit).toBe(0);
    expect(await Bun.file(path.join(dir, "out/src/counter.tsx")).exists()).toBe(false);
    expect((await run()).exit).toBe(0);
    expect(await Bun.file(path.join(dir, "out/src/counter.tsx")).text()).toContain("__mtx.state");
    expect(await Bun.file(path.join(dir, "out/src/plain.ts")).exists()).toBe(false);
    expect((await run("--all")).exit).toBe(0);
    expect(await Bun.file(path.join(dir, "out/src/plain.ts")).text()).toBe(
      "export const plain = 1;\n",
    );
    await writeFile(
      path.join(dir, "src/bad.ts"),
      'import { client } from "maniatsx/client";\nclient.handler(() => { throw new Error("bad"); });\n',
    );
    const failed = await run("--check");
    expect(failed.exit).toBe(1);
    expect(failed.stderr).toContain("bad.ts:2:");
    expect(failed.stderr).toContain(" error ");
    expect((await run()).exit).toBe(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
