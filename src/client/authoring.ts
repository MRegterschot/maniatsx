// Authoring API for client code. The compiler rewrites every call below into a `__mtx.*` call;
// reaching one of these bodies at runtime means the build transform did not run.
import {
  CLIENT,
  type ClientAction,
  type ClientBinding,
  type ClientFn,
  type ClientHandler,
  type ClientState,
} from "./contract.ts";

import type { CMlScriptIngame } from "../maniascript/api.generated.ts";
import { clientOnly } from "../maniascript/client-only.ts";

export type { Integer, Real, Text, Ident, Vec2, Vec3, Int2, Int3 } from "../maniascript/types.ts";

// The manialink script context: `ml.Page`, `ml.LocalUser`, `ml.Now`… compile to `Page`, `LocalUser`, `Now`
export const ml = clientOnly<CMlScriptIngame>("ml");

function notCompiled(api: string): never {
  throw new Error(
    `${api} was not compiled: add the maniatsx build transform (Bun plugin or \`maniatsx compile\`)`,
  );
}

export const client = {
  // Client-side variable; `initial` is evaluated on the server and sent as a literal
  state<T>(initial: T): ClientState<T> {
    void initial;
    return notCompiled("client.state");
  },
  // Event handler for on* props (onClick, onRightClick, onMouseOver, onMouseOut, onSubmit)
  handler(body: () => void): ClientHandler {
    void body;
    return notCompiled("client.handler");
  },
  // Attribute value computed on the client and kept up to date when state changes
  bind<T>(expr: () => T): ClientBinding<T> {
    void expr;
    return notCompiled("client.bind");
  },
  // Module-level ManiaScript function; call it from client code like a normal function
  fn<F extends (...args: never[]) => unknown>(fn: F): F & ClientFn {
    void fn;
    return notCompiled("client.fn");
  },
  // Runs once when the page loads
  onInit(body: () => void): void {
    void body;
    notCompiled("client.onInit");
  },
  // Runs every frame; keep it cheap
  onFrame(body: () => void): void {
    void body;
    notCompiled("client.onFrame");
  },
};

export interface Action extends ClientAction {
  // Client code only: sends TriggerPageAction(name, args joined with "|")
  trigger(...args: string[]): void;
}

// Actions are plain data, so they work without the compiler; trigger() only exists in client code
export function action(name: string): Action {
  if (!/^[\w.:-]+$/.test(name)) throw new Error(`action(): invalid name ${JSON.stringify(name)}`);
  return {
    $$typeof: CLIENT,
    kind: "action",
    name,
    trigger: () => notCompiled(`action("${name}").trigger`),
  };
}
