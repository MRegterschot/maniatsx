// Dev tool: shows a rendered page on a dedicated server and logs the actions it triggers.
import { GbxClient } from "@evotm/gbxclient";

const usage = `Usage: bun run send <page.xml> [--login <player>] [--host 127.0.0.1] [--port 5010]
                     [--user SuperAdmin] [--password SuperAdmin]
Keeps running and prints every PlayerManialinkPageAnswer; Ctrl+C hides the page and exits.`;

const args = process.argv.slice(2);
const opts: Record<string, string> = {
  host: "127.0.0.1",
  port: "5010",
  user: "SuperAdmin",
  password: "SuperAdmin",
};
let file: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--help") {
    console.log(usage);
    process.exit(0);
  }
  if (arg.startsWith("--")) opts[arg.slice(2)] = args[++i] ?? "";
  else file = arg;
}
if (!file) {
  console.error(usage);
  process.exit(1);
}

const xml = await Bun.file(file).text();
const id = /<manialink[^>]*\bid="([^"]+)"/.exec(xml)?.[1];
if (!id) throw new Error(`${file}: no <manialink id="…"> found`);

const gbx = new GbxClient({ showErrors: true, throwErrors: true });
if (!(await gbx.connect(opts.host!, Number(opts.port)))) {
  throw new Error(`Can't reach the XML-RPC port at ${opts.host}:${opts.port}`);
}
await gbx.call("Authenticate", opts.user, opts.password);
await gbx.call("SetApiVersion", "2023-04-24");
await gbx.call("EnableCallbacks", true);

const show = (page: string) =>
  opts.login
    ? gbx.call("SendDisplayManialinkPageToLogin", opts.login, page, 0, false)
    : gbx.call("SendDisplayManialinkPage", page, 0, false);
await show(xml);
console.log(
  `Showing "${id}" (${xml.length} bytes) to ${opts.login ?? "everyone"}. Ctrl+C to hide.`,
);

gbx.on("callback", (method: string, params: unknown[]) => {
  if (method !== "ManiaPlanet.PlayerManialinkPageAnswer") return;
  const [, login, answer, entries] = params as [number, string, string, unknown];
  console.log(`[action] ${login}: ${JSON.stringify(answer)} entries=${JSON.stringify(entries)}`);
});

process.on("SIGINT", async () => {
  // An empty page with the same id replaces (hides) it
  await show(`<manialink id="${id}" version="3"></manialink>`).catch(() => {});
  await gbx.gbx.disconnect().catch(() => {});
  process.exit(0);
});
