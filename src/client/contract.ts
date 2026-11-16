// Phase 2 contract between the build-time compiler (emits these) and the render-time runtime (consumes them).

export const CLIENT = Symbol.for("maniatsx.client");

export type MsPrimitive =
  "Integer" | "Real" | "Boolean" | "Text" | "Vec2" | "Vec3" | "Int2" | "Int3" | "Ident";

export type MsType =
  | MsPrimitive
  | { readonly array: MsType }
  | { readonly record: { readonly key: "Integer" | "Text" | "Ident"; readonly value: MsType } }
  // `fields` is only filled for values that cross the server boundary (client.shared), so literals can be emitted
  | {
      readonly struct: string;
      readonly fields?: readonly { readonly name: string; readonly type: MsType }[];
    };

// "src/widget.tsx:12:5", used in errors and pretty-mode comments
export type SourceSite = string;

// A gap in compiled code, filled at render time.
export type Hole =
  // Server value captured by the closure, emitted as a literal of `type`
  | { readonly kind: "value"; readonly type: MsType; readonly get: () => unknown }
  // Global variable name of a client.state handle
  | { readonly kind: "state"; readonly get: () => ClientState }
  // Global variable name of a client.shared handle (a `for This` variable declared in main)
  | { readonly kind: "shared"; readonly get: () => ClientShared }
  // Function name of a client.fn; using it registers the function
  | { readonly kind: "fn"; readonly get: () => ClientFn }
  // Global variable name of a client.ref handle; using it requires the ref to be attached to an element
  | { readonly kind: "ref"; readonly get: () => ClientRef }
  // Action name of an action() handle, emitted as a Text literal
  | { readonly kind: "action"; readonly get: () => ClientAction }
  // Qualifier of a ManiaScript lib (`MathLib` in `MathLib::Abs`), resolved to the page's #Include alias
  | { readonly kind: "lib"; readonly lib: string };

// ManiaScript with holes: code.length === holes.length + 1, joined as code[0] + hole[0] + code[1] ...
export interface CompiledCode {
  readonly code: readonly string[];
  readonly holes: readonly Hole[];
  // Full `#Struct K_Name { ... }` declarations the code needs
  readonly structs: readonly string[];
  readonly site: SourceSite;
}

// Runtime handles. All carry $$typeof: CLIENT plus a discriminating `kind`.

export interface ClientState<T = unknown> {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "state";
  readonly type: MsType;
  readonly initial: CompiledCode; // usually a single value hole
  readonly site: SourceSite;
  // Kept across page re-sends (`declare … for Page`); the key defaults to a hash of `site`
  readonly persist?: { readonly key?: string };
  // Type-level only: client code reads/writes `.value`; the compiler rewrites it
  value: T;
}

// Server-written, client-read value shared between pages (`declare … for This`) with a version counter
export interface ClientShared<T = unknown> {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "shared";
  readonly key: string;
  readonly type: MsType;
  readonly initial: CompiledCode; // value used until something is published
  readonly site: SourceSite;
  // Type-level only: client code reads `.value`; writing is a compile error (use <Publish>)
  readonly value: T;
}

export interface ClientStateOptions {
  // Survive the page being re-sent with the same manialink id; `initial` only applies the first time
  persist?: boolean;
  // Stable name part for persisted state (letters, digits, `_`); defaults to a hash of the source site
  key?: string;
}

export interface ClientRef<T = unknown> {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "ref";
  readonly cls: string; // ManiaScript control class, e.g. "CMlLabel"
  readonly site: SourceSite;
  // Type-level only: client code reads `.control`; the compiler rewrites it to the ref's global
  readonly control: T;
}

export interface ClientHandler {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "handler";
  readonly body: CompiledCode; // statements
}

export interface ClientBinding<T = unknown> {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "bind";
  readonly type: MsType;
  readonly expr: CompiledCode; // one expression of `type`
  // Type-level only, so bindings are assignable to attribute types
  readonly __value?: T;
}

export interface ClientFn {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "fn";
  readonly name: string; // stable, e.g. "Mtx_F_widget_clamp"
  readonly declaration: CompiledCode; // full function definition
}

export interface ClientAction {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "action";
  readonly name: string;
}

// Lifecycle blocks registered while a component renders
export interface ClientLifecycle {
  readonly $$typeof: typeof CLIENT;
  readonly kind: "init" | "frame";
  readonly body: CompiledCode;
}

// What the compiler rewrites each authoring call into (exported by maniatsx/client as `__mtx`)
export interface CompiledRuntime {
  state<T>(
    type: MsType,
    initial: CompiledCode,
    site: SourceSite,
    options?: ClientStateOptions,
  ): ClientState<T>;
  shared<T>(key: string, type: MsType, initial: CompiledCode, site: SourceSite): ClientShared<T>;
  watch(shared: ClientShared, body: CompiledCode): void;
  ref<T>(cls: string, site: SourceSite): ClientRef<T>;
  handler(body: CompiledCode): ClientHandler;
  bind<T>(type: MsType, expr: CompiledCode): ClientBinding<T>;
  fn(name: string, declaration: CompiledCode): ClientFn;
  onInit(body: CompiledCode): void;
  onFrame(body: CompiledCode): void;
}

// Reserved ManiaScript names: everything prefixed Mtx_. The compiler emits `Mtx_Dirty = True;` after
// every state write; the runtime declares Mtx_Dirty and re-evaluates bindings when it is set. Pages
// without bindings drop the flag and its writes entirely.
export const DIRTY_FLAG = "Mtx_Dirty";
