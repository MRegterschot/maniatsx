// Copies the ManialinkBridge Openplanet plugin into the Windows user's OpenplanetNext/Plugins folder (WSL).
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { bridgeRoot } from "./bridge-paths.ts";

const target = join(bridgeRoot().openplanet, "Plugins", "ManialinkBridge");
const source = new URL("../tools/openplanet/ManialinkBridge/", import.meta.url).pathname;
cpSync(source, target, { recursive: true });
console.log(`Installed to ${target}`);
console.log(
  existsSync(join(target, "Main.as"))
    ? "In game: Openplanet > Developer > (Re)load plugin > Manialink Bridge"
    : "Copy failed",
);
