# maniatsx contributor guide

TSX → Trackmania Manialink v3 XML renderer. `PLAN.md` holds the spec (requirements, architecture, milestones); treat it as the source of truth and keep it in sync if a decision changes.

## Commands (Bun 1.4, TypeScript 7)

- `bun run typecheck`: `tsc --noEmit` over src, test, scripts, examples, bench.
- `bun test`: unit, type, golden, and XSD validation tests in `test/`.
- `bun run gen`: regenerate `src/generated/intrinsics.ts` from `vendor/manialink_v3.xsd`.
- `bun run build`: emit `dist/` (ESM + `.d.ts`).
- Format changed files with `bunx prettier --write <files>`.

## Conventions

- ESM, strict TS. Relative imports use the `.ts` extension (`./render.ts`); tsc rewrites them on build.
- Zero runtime dependencies. Dev dependencies only for codegen and tests.
- `src/vnode.ts` and `src/jsx-types.ts` are the shared contracts; change them deliberately.
- Never hand-edit `src/generated/`; fix XSD problems in `src/intrinsics-overrides.ts`.
- Errors that would produce invalid XML or ManiaScript throw with a message naming the element or attribute. Softer problems go to the `onWarning` render option.
- Comments: one or two lines, the why not the what. No long docblocks (TSDoc copied from the XSD into generated typings is fine).
- Tests: `bun:test`, one file per module (`test/render.test.tsx`, …). Type-level tests use `// @ts-expect-error` in files covered by typecheck.
