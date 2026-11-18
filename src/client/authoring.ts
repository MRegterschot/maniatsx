// Authoring API for client code. The compiler rewrites every call below into a `__mtx.*` call;
// reaching one of these bodies at runtime means the build transform did not run.
import {
  CLIENT,
  type ClientAction,
  type ClientBinding,
  type ClientFn,
  type ClientHandler,
  type ClientRef,
  type ClientShared,
  type ClientState,
  type ClientStateOptions,
} from "./contract.ts";

import type {
  CMlControl,
  CMlScriptEvent,
  CSmMlScriptIngame,
} from "../maniascript/api.generated.ts";
import { clientOnly } from "../maniascript/client-only.ts";

export type { Integer, Real, Text, Ident, Vec2, Vec3, Int2, Int3 } from "../maniascript/types.ts";

// The manialink script context: `ml.Page`, `ml.LocalUser`, `ml.Now`… compile to `Page`, `LocalUser`, `Now`
export const ml = clientOnly<CSmMlScriptIngame>("ml");

function notCompiled(api: string): never {
  throw new Error(
    `${api} was not compiled: add the maniatsx build transform (Bun plugin or \`maniatsx compile\`)`,
  );
}

export const client = {
  // Client-side variable; `initial` is evaluated on the server and sent as a literal.
  // `{ persist: true }` keeps it across page re-sends; the options must be literals
  state<T>(initial: T, options?: ClientStateOptions): ClientState<T> {
    void initial;
    void options;
    return notCompiled("client.state");
  },
  // Value written by an update page (<Publish>) and read here; the key is a literal and names the `for This` variable
  shared<T>(key: string, initial: T): ClientShared<T> {
    void key;
    void initial;
    return notCompiled("client.shared");
  },
  // Runs `body` when the shared value changes (and once at init if it was already published)
  watch<T>(shared: ClientShared<T>, body: () => void): void {
    void shared;
    void body;
    notCompiled("client.watch");
  },
  // Handle to a control: pass it as `ref` to an element, read `.control` in client code. The type argument is required
  ref<T extends CMlControl>(): ClientRef<T> {
    return notCompiled("client.ref");
  },
  // Event handler for on* props (onClick, onRightClick, onMouseOver, onMouseOut, onSubmit).
  // The optional parameter is the script event, e.g. `event.Control` inside a framemodel instance
  handler(body: (event: CMlScriptEvent) => void): ClientHandler {
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
