import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Result = { ok: true } | { ok: false; error: string };
export type PingResult = Result & {
  context: "none" | "menu" | "playground";
  layers: number;
  pages: number;
  display: [number, number];
};
export type ShowResult = Result & { scriptRunning: boolean; tree: unknown };
export type ScreenshotResult = Result & { path: string };

export class Bridge {
  constructor(
    readonly storageDir: string,
    readonly timeoutMs = 15_000,
  ) {}

  ping() {
    return this.request<PingResult>({ cmd: "ping" });
  }
  show(page: string, xml: string, options: { hideOthers?: boolean; waitFrames?: number } = {}) {
    return this.request<ShowResult>({ cmd: "show", page, xml, ...options });
  }
  inspect(page: string) {
    return this.request<ShowResult>({ cmd: "inspect", page });
  }
  screenshot(options: { width?: number; height?: number; timeoutMs?: number } = {}) {
    return this.request<ScreenshotResult>({ cmd: "screenshot", ...options });
  }
  clear(page?: string) {
    return this.request<PingResult>({ cmd: "clear", ...(page ? { page } : {}) });
  }

  private async request<T extends Result>(payload: object): Promise<T> {
    const id = randomUUID();
    const inbox = join(this.storageDir, "inbox");
    const outbox = join(this.storageDir, "outbox");
    await Promise.all([mkdir(inbox, { recursive: true }), mkdir(outbox, { recursive: true })]);
    const tmp = join(inbox, `${id}.tmp`);
    const request = join(inbox, `${id}.json`);
    await writeFile(tmp, JSON.stringify(payload));
    await rename(tmp, request);
    const answer = join(outbox, `${id}.json`);
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        const result = JSON.parse(await readFile(answer, "utf8")) as T;
        await rm(answer, { force: true });
        if (!result.ok) throw new Error(result.error);
        return result;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await Bun.sleep(50);
    }
    throw new Error(
      `Timed out waiting for Manialink Bridge (${this.timeoutMs} ms). Load the plugin in Openplanet and be in game.`,
    );
  }
}
