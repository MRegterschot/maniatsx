---
title: Client code
description: Compile a restricted TypeScript subset into ManiaScript for in-game state and interactions.
sidebar:
  order: 4
---

# Client code

Client code is TypeScript authored in `client.*` closures and compiled at build time into ManiaScript. Server values cross into the client as literals. This compiler is experimental; see [testing](testing.md) for verification limits.

## Supported TypeScript subset

| TypeScript                                                                   | Emitted form                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `const` / `let` with initializer                                             | Typed `declare` / `let`                                      |
| `if`/`else`, `while`, `break`, `continue`, `return`                          | Corresponding ManiaScript statements                         |
| `for (const x of arr)`                                                       | `foreach (X in Arr)`                                         |
| `for (const [k, v] of Object.entries(record))`                               | `foreach (K => V in Rec)`                                    |
| `for (let i = a; i < b; i++)` in the supported shape                         | ManiaScript counted loop                                     |
| `switch`, conditional `?:`                                                   | `switch`; temporary plus `if`/`else`                         |
| Template strings and string `+`                                              | ManiaScript `^` concatenation                                |
| `===`, `!==`, `&&`, `                                                        |                                                              | `, `!` | `==`, `!=`, and corresponding operators |
| `x as CMlLabel`                                                              | Typed ManiaScript cast                                       |
| Array `length`, `push`, `includes`, `indexOf`, `splice(i, 1)`, `Object.keys` | Whitelisted ManiaScript collection operations                |
| `Math.abs/min/max/floor/round/...`                                           | `MathLib` equivalents                                        |
| `console.log`                                                                | ManiaScript `log()`                                          |
| Top-level `client.fn`                                                        | ManiaScript function; recursion is allowed, closures are not |

Classes, `this`, async/await, generators, exceptions, spread/rest, most destructuring, optional chaining, `??`, regex, `Date`, `JSON`, `delete`, `typeof`, `instanceof`, and imports outside `maniatsx/client` and `maniatsx/maniascript` are rejected. See D4 in `PLAN-phase2.md` for details.

## Authoring APIs

- `client.state<T>(initial)` declares client-side state. Writes mark bindings dirty.
- `client.handler((event) => { ... })` attaches a handler to supported `on*` element props. The optional `event` is the `CMlScriptEvent`, so one handler can serve many controls, e.g. rows of a `<framemodel>` that share ids: read `event.Control.Parent.DataAttributeGet(...)` to tell them apart.
- `client.bind(() => value)` updates supported attributes when state changes.
- `client.ref<CMlLabel>()` creates a typed control reference, attached with `ref={nameRef}`. A used ref must be attached exactly once.
- `client.fn((args) => ...)` declares a top-level function.
- `client.onInit` runs on page load; `client.onFrame` runs every frame and should stay cheap.

```tsx
const count = client.state<Integer>(0);
<label text={client.bind(() => "Clicks: " + count.value)} />
<quad onClick={client.handler(() => { count.value += 1; })} />
```

`action(name).trigger(...args)` sends a page action; arguments are joined with `|` and not escaped, so an argument must not contain `|`. Supported bindings and event props are documented in D5 of `PLAN-phase2.md`.

## Persisted state

`client.state<boolean>(false, { persist: true })` survives re-sends with the same Manialink ID and layer. Initial values apply only the first time. A source-position-derived key changes when the call moves; provide a literal `key`, such as `{ persist: true, key: "open" }`, to keep a stable name.

Builds can set `keyPrefix` (or CLI `--key-prefix`) to namespace shared and persisted storage names, including source-derived persisted names. Use a distinct prefix per plugin because `for This` shared values outlive layers and are visible across them.

## Shared values and Publish

`client.shared<T>(key, initial)` defines a server-written value shared by an update page and a reader page. Both import the same handle. Client code reads its read-only `.value`; `client.watch(shared, () => ...)` runs when a new version arrives. The update page writes with `<Publish to={shared} value={data} />` inside its Manialink. Keys must be string literals and cannot end in `_V` or `_Seen`. Shared values use ManiaScript `for This` storage; namespace keys because that storage outlives page layers.

## Build transform required

Without the compiler transform, authoring calls throw a “was not compiled” error explaining that the Bun plugin or `maniatsx compile` is required. Do not run client-authored modules directly without a configured transform.

## Compiler errors

Every diagnostic has a source location (file:line:col), a code and a message. Messages quote the offending code and usually name the supported alternative; `…` below stands for the quoted code or name. Code outside the subset can always move into hand-written ManiaScript with [script composition](components.md#script-composition).

| Code | Message |
|---|---|
| `action` | `action(...)` inside client code is not supported in client code. Create the action outside the closure and call `.trigger()` on it. / An action with a non-literal name inside client code is not supported in client code. Create the action outside the closure. |
| `anonymous-type` | Object types in client code need a name. Declare an `interface` and use it here. |
| `api` | `…` on its own is not supported in client code. Call a function on it. / `…` is not supported in client code. Only enum members of API classes can be used as values. |
| `array-method` | The array method `.…` with … argument(s) is not supported in client code. Supported: push(x), includes(x), indexOf(x), splice(i, 1), length. Use a for/while loop for map/filter/reduce. |
| `as` | A cast to … is not supported in client code. Only casts to API classes (for example `as CMlLabel`) are supported. |
| `as-const` | `as const` is not supported in client code. |
| `assign-capture` | `…` is a server value captured by this closure and cannot be assigned. Use client.state for values that change on the client. |
| `assign-shared` | `…` is a client.shared value and is read-only in client code. Write it from the server side with <Publish to={...} value={...} />. |
| `assignment` | An assignment used as an expression is not supported in client code. Assignments must be their own statements. |
| `async` | `for await` is not supported in client code. / `await` is not supported in client code. ManiaScript has no promises; use `yield;` patterns via client.onFrame. |
| `bare-number` | Bare `number` is not allowed in client code: it does not say whether the value is a ManiaScript Integer or Real. Use `Integer` or `Real` from maniatsx/client. / `…` is a number without an Integer or Real annotation, so the compiler cannot pick the ManiaScript type. Annotate it, for example `…: Integer`. |
| `bigint` | BigInt literals is not supported in client code. |
| `bind-body` | A client.bind callback must be a single expression, e.g. `() => count.value + 1`. |
| `bind-type` | Cannot determine binding type. |
| `bitwise` | Bitwise `~` is not supported in client code. ManiaScript has no bitwise operators. / The `…` operator is not supported in client code. ManiaScript has no bitwise operators. |
| `break` | `break` outside of a loop or switch. / `break` inside a switch is only supported as the last statement of a case. |
| `call` | Calling `…` is not supported in client code. Only game API functions and module-level `client.fn` helpers can be called from client code. / Calling `…` is not supported in client code. |
| `capture-function` | The function `…` is not supported in client code. Define it with a module-level `client.fn`, or call a game API function directly. |
| `capture-type` | `…` cannot be captured: objects and Ident values cannot cross the server boundary. Capture a primitive value instead. / `…` cannot be captured: its type (…) is not an Integer, Real, Boolean, Text, Ident, vector, array, record or struct. |
| `class` | Classes is not supported in client code. Use an interface for data. / Classes is not supported in client code. |
| `client` | `client` inside client code is not supported in client code. Client constructs cannot be nested. |
| `closure` | Nested functions is not supported in client code. Define a module-level `client.fn`. / Nested closures is not supported in client code. Only client.handler/bind/fn/onInit/onFrame callbacks are compiled; use a module-level `client.fn` for helpers. |
| `condition` | Conditions must be Boolean, found … (`…`). Compare explicitly, for example `x > 0`. |
| `conditional` | A conditional expression in a client.bind is not supported in client code. Move the logic into a `client.fn` with if/else and call it from the binding. / A conditional expression on the right of && or \|\| is not supported in client code. Use an if/else statement. |
| `conditional-type` | A conditional expression whose type cannot be inferred is not supported in client code. Annotate the target variable, e.g. `const x: Integer = ...`. |
| `continue` | `continue` outside of a loop. |
| `delete` | `delete` is not supported in client code. Use `rec.removekey` via splice on arrays; records cannot shrink in client code. |
| `destructuring` | Destructuring is not supported in client code. Declare one variable per value. / Destructuring assignment is not supported in client code. |
| `do-while` | do/while is not supported in client code. Use `while`. |
| `empty-array` | An empty array literal without a known type is not supported in client code. Annotate the target, e.g. `const xs: Integer[] = []`. |
| `entries` | `Object.entries` on a non-record value is not supported in client code. Use it on a Record<Text \| Integer, T>. / `Object.entries` outside a for-of loop is not supported in client code. Use `for (const [k, v] of Object.entries(rec))`. |
| `expression` | The `…` expression is not supported in client code. |
| `expression-statement` | This expression statement does nothing (`…`). Client statements must be calls, assignments or ++/--. |
| `fallthrough` | A non-empty switch case falls through to the next one. End it with `break`, or merge the cases. |
| `fn-shape` | client.fn expects an arrow function or function expression. |
| `for-in` | for/in is not supported in client code. Use `for (const k of Object.keys(rec))`. |
| `for-of` | This `for...of` loop is not supported in client code. Use `for (const x of arr)`. / Iterating a non-array value is not supported in client code. Iterate arrays, or `Object.keys(rec)`. |
| `for-shape` | This `for` loop is not supported in client code. Use exactly `for (let i = a; i < b; i++)`, or `for (const x of arr)` / `for (const [k, v] of Object.entries(rec))`. |
| `generator` | Generators is not supported in client code. / Generators are not supported in client code. |
| `global` | `….…` is not supported in client code. |
| `handle` | `…` is a client handle, not a value. ${"state" in e.ty ? "Read or write  / `…` is an action. Only `.trigger(...)` can be used in client code. |
| `import` | Calling an import from … is not supported in client code. |
| `increment` | `++`/`--` inside an expression is not supported in client code. Use it as its own statement. |
| `index` | Indexing a non-array value is not supported in client code. |
| `int-division` | Integer / Integer is integer division in ManiaScript, but the result is used as a Real. Convert an operand first, for example `MathLib.ToReal(a) / MathLib.ToReal(b)`. |
| `internal-error` | An unexpected compiler failure. Report the source and location. |
| `jsx` | JSX is not supported in client code. |
| `keys` | `Object.keys` in a binding or on the right of && or \|\| is not supported in client code. Assign it to a local first. / `Object.keys` on a non-record value is not supported in client code. |
| `label` | Labels is not supported in client code. Restructure the loop. |
| `math` | `Math.…` is not supported in client code. Use the MathLib equivalents. / `Math.…` is not supported in client code. Use the MathLib functions directly. |
| `member` | `…` is not supported in client code. / `.…` on an array or record is not supported in client code. Supported: length, push, includes, indexOf, splice(i, 1), Object.keys. |
| `missing-type` | A type annotation is required here. / Parameter `…` of a client.fn needs a type annotation (Integer, Real, Text, ...). |
| `mixed-number` | Integer and Real are mixed in `…` (… and …). Convert explicitly with MathLib.ToReal or MathLib.NearestInteger. |
| `ml` | `ml` on its own is not supported in client code. Access a member, for example `ml.Page`. |
| `nested` | A client construct inside client code is not supported in client code. client.state/shared/watch/handler/bind/fn/onInit/onFrame must be called outside closures. |
| `new` | `new …` is not supported in client code. Use an object literal for structs, or an array literal. |
| `number-literal` | The literal `…` is not an integer but an Integer is expected here. / The literal `…` is outside the safe Integer range. |
| `object-literal` | An object literal without a known struct or record type is not supported in client code. Declare the target with an interface, e.g. `const p: Point = { X: 1, Y: 2 }`. / Spread, methods and accessors in an object literal is not supported in client code. |
| `operator` | The `…` operator is not supported in client code. / The … operator is not supported in client code. |
| `optional-chain` | Optional chaining is not supported in client code. Check for null explicitly. / Optional chaining is not supported in client code. |
| `overload` | No signature of `…` takes … argument(s) of these types (…). / The arguments (…) do not match any signature of `…`. Check Integer vs Real; convert explicitly with MathLib.ToReal or MathLib.NearestInteger. |
| `param` | Closure parameters are only supported on client.fn. |
| `real-to-integer` | A Real value (`…`) is used where an Integer is expected. Convert explicitly with MathLib.FloorInteger, MathLib.NearestInteger, MathLib.TruncInteger or MathLib.CeilingInteger. |
| `record-key` | Record keys must be Text, Integer or Ident. / Unsupported Record type. |
| `record-method` | The record method `.…` is not supported in client code. Use Object.keys(rec) and indexing. |
| `ref-type` | `…` needs a type argument naming the control class, for example `client.ref<CMlLabel>()`. / `client.ref<…>` must name a ManiaScript control class such as CMlLabel. |
| `regex` | Regular expressions is not supported in client code. Use TextLib functions. |
| `rest` | Rest parameters are not supported in client code. |
| `return` | `return` is not allowed in client.onInit/onFrame because it would leave the page script's main loop. Use if/else. / A client.handler cannot return a value. |
| `satisfies` | `satisfies` is not supported in client code. |
| `shared-initial` | client.shared needs an initial value. |
| `shared-key` | A client.shared key may only contain letters, digits and `_`, must start with a letter and must not end in `_V` or `_Seen`. |
| `shared-type` | This client.shared type cannot be written as a ManiaScript literal. |
| `spread` | Spread is not supported in client code. / Spread in an array literal is not supported in client code. |
| `state-options` | The options object of client.state must be a literal with only `persist` (true) and an optional literal `key`; `key` needs `persist`. |
| `state-type` | client.state needs an initial value. |
| `statement` | The `…` statement is not supported in client code. |
| `struct-member` | Struct `…` member `…` must be a plain property; methods are not allowed. |
| `tagged-template` | Tagged templates is not supported in client code. |
| `text-method` | The string method `.…` is not supported in client code. Use TextLib functions such as TextLib.SubString, TextLib.Length, TextLib.Replace. |
| `this` | `this` is not supported in client code. |
| `throw` | `throw` is not supported in client code. ManiaScript has no exceptions; use `log(...)` and return. |
| `try` | try/catch is not supported in client code. ManiaScript has no exceptions; check conditions explicitly. |
| `typeof` | `typeof` is not supported in client code. |
| `union-type` | Union types are only allowed as `T \| null` on API class references. |
| `unresolved` | Cannot resolve this identifier. / The identifier `…` is not supported in client code. Make sure it is declared and typed. |
| `unsupported-type` | Unsupported type `…` in client code. / Cannot determine the ManiaScript type of `…`. |
| `untyped` | Cannot infer the type of `…`. Annotate the declaration. / `…` needs an initial value or a type annotation. |
| `var` | `var` is not supported in client code. Use `const` or `let`. |
| `void` | `void` is not supported in client code. |

A "was not compiled" error at runtime is not a compiler diagnostic: it means the build transform did not run for that file (see [tooling](tooling.md)).
