# 0002 — Composer and effect merging

Status: accepted, 2026-10-11. The merge-equivalence proof (X1.4c) is an M1 exit criterion; if it fails, this record is revisited before M2.

## Context

three.js's example `EffectComposer` runs every pass as its own full-screen draw, which costs a render-target round trip per effect. pmndrs/postprocessing merges compatible effects into one shader and is the established alternative. xtree needs parameter schemas, a motion policy, HoloCSS stage interop and per-effect exports that neither offers.

## Decision

- xtree has its own `EffectComposer`. Consecutive screen-space effects are compiled into one fragment shader with namespaced uniforms and functions. Multi-pass effects (bloom, depth of field, SSAO) run their own passes and may expose a final composite function that joins the merged shader.
- Every xtree pass also implements three.js's `Pass` interface, so it runs inside a stock `EffectComposer`. A three/examples pass can be wrapped as an xtree pass.
- pmndrs/postprocessing is not a dependency. Its merging approach is the reference design, credited in the docs.
- Shared GLSL is resolved at **runtime** by `resolveIncludes`, not inlined at build time. Merged effects then share one copy of each chunk, and the composer can dedupe across effects. Chunks are kept minified as strings, and `#line` directives map compile errors back to the chunk.

## Consequences

Parameter changes must never recompile; only structural changes (defines, the effect list) do. The merge compiler is the riskiest core work, so M1 proves it with five effects before the catalogue grows. An unmerged debug mode stays available permanently.
