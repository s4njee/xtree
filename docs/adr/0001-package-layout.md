# 0001 — Package layout and toolchain

Status: accepted, 2026-10-11 (M0).

## Context

xtree ships one library, `@mk7s/xtree`, and a documentation site. HoloCSS, the sibling design-system project, uses a single package with pnpm, TypeScript, Vite, Vitest and Playwright, and a `pnpm check` gate. The docs site uses VitePress, which brings its own Vite version and a Vue runtime that the library must not depend on.

## Decision

- A pnpm workspace with two packages: `packages/xtree` (the library, `@mk7s/xtree`) and `docs` (the private VitePress site). The VitePress and Vue dependency tree stays out of the library's dependencies.
- ESM only, one subpath export per family or effect (`@mk7s/xtree/shaders/noise`, later `@mk7s/xtree/effects/<id>`). `sideEffects: false`. Every export has a gzip budget in `size-budgets.json`.
- The library is built with Vite 8 library mode (Rolldown) and declarations come from `tsc`. GLSL files are imported as strings through a small Vite plugin that minifies them in production without changing line numbers.
- **TypeScript 6.0** rather than HoloCSS's 7.0: typescript-eslint and TypeDoc support TypeScript only up to 6.0. Revisit when they support the native TypeScript 7 compiler.
- Node 22.12 or newer and pnpm 11.15.1, the same as HoloCSS.
- `pnpm check` is the single gate: format, lint, GLSL lint, credits, typecheck, build, size, generated-docs freshness and unit tests. GPU tests run separately with `pnpm test:browser` because they need browsers.

## Consequences

Library-only scripts live in `packages/xtree/scripts` and run against the TypeScript source through Vite's `runnerImport`, so they need no build step. Adding an export means adding an entry in `build/entries.ts`, the `exports` map and `size-budgets.json`; the size check fails if any of the three disagree.
