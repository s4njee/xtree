# 0002 — Composer and effect merging

Status: accepted, 2026-10-11. M1 confirmed it: merged and unmerged stacks match within ΔE 1 for 99.9% of pixels, and no pixel exceeds ΔE 3. The rare larger differences are at extreme HDR edges, where the same math in different programs rounds differently (see the [M1 validation](/project/m1-validation)).

## Context

three.js's example `EffectComposer` runs every pass as its own full-screen draw, which costs a render-target round trip per effect. pmndrs/postprocessing merges compatible effects into one shader and is the established alternative. xtree needs parameter schemas, a motion policy, HoloCSS stage interop and per-effect exports that neither offers.

## Decision

- xtree has its own `EffectComposer`. Consecutive screen-space effects are compiled into one fragment shader with namespaced uniforms and functions. Multi-pass effects (bloom, depth of field, SSAO) run their own passes and may expose a final composite function that joins the merged shader.
- Every xtree pass also implements three.js's `Pass` interface, so it runs inside a stock `EffectComposer`. A three/examples pass can be wrapped as an xtree pass.
- pmndrs/postprocessing is not a dependency. Its merging approach is the reference design, credited in the docs.
- Shared GLSL is resolved at **runtime** by `resolveIncludes`, not inlined at build time. Merged effects then share one copy of each chunk, and the composer can dedupe across effects. Chunks are kept minified as strings, and `#line` directives map compile errors back to the chunk.

## Consequences

Parameter changes must never recompile; only structural changes (defines, the effect list) do. The merge compiler is the riskiest core work, so M1 proves it with five effects before the catalogue grows. An unmerged debug mode stays available permanently.
