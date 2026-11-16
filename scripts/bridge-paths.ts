// Resolves the Windows user's OpenplanetNext folder from WSL, overridable with OPENPLANET_DIR.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export function bridgeRoot(): { openplanet: string; storage: string } {
  const openplanet =
    process.env.OPENPLANET_DIR ??
    join(
      execFileSync("wslpath", [
        execFileSync("powershell.exe", ["-NoProfile", "-Command", "$env:USERPROFILE"])
          .toString()
          .trim(),
      ])
        .toString()
        .trim(),
      "OpenplanetNext",
    );
  return { openplanet, storage: join(openplanet, "PluginStorage", "ManialinkBridge") };
}
