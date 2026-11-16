import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Bridge } from "../scripts/bridge-client.ts";

test("exchanges atomic request and response files with a fake plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "maniatsx-bridge-"));
  try {
    const bridge = new Bridge(root, 1000);
    const answer = (async () => {
      const inbox = join(root, "inbox");
      while (true) {
        await mkdir(inbox, { recursive: true });
        const files = await Array.fromAsync(new Bun.Glob("*.json").scan({ cwd: inbox }));
        if (files.length) {
          const request = JSON.parse(await readFile(join(inbox, files[0]!), "utf8"));
          const id = files[0]!.replace(".json", "");
          await writeFile(
            join(root, "outbox", `${id}.json`),
            JSON.stringify({
              ok: true,
              context: "menu",
              layers: 0,
              pages: 0,
              display: [1920, 1080],
              cmd: request.cmd,
            }),
          );
          return;
        }
        await Bun.sleep(5);
      }
    })();
    const result = await bridge.ping();
    await answer;
    expect(result.context).toBe("menu");
    const files = await Array.fromAsync(new Bun.Glob("*.json").scan({ cwd: join(root, "outbox") }));
    expect(files).toHaveLength(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
