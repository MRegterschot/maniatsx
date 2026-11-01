import type { Component, Node } from "./vnode.ts";

export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
  readonly Provider: Component<{ value: T; children?: Node }>;
}

export interface ContextEntry {
  readonly id: symbol;
  readonly value: unknown;
}

// Render-internal: the walker intercepts providers and keeps the active stack here.
export const providers = new WeakMap<Function, Context<any>>();
export const contextRuntime: { stack: ContextEntry[] | null } = { stack: null };

export function createContext<T>(defaultValue: T): Context<T> {
  const id = Symbol("maniatsx.context");
  const Provider: Context<T>["Provider"] = ({ children }) => children;
  const ctx: Context<T> = { id, defaultValue, Provider };
  providers.set(Provider, ctx);
  return ctx;
}

export function useContext<T>(ctx: Context<T>): T {
  const stack = contextRuntime.stack;
  if (!stack) throw new Error("useContext() can only be called while rendering");
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]!.id === ctx.id) return stack[i]!.value as T;
  }
  return ctx.defaultValue;
}
