# 0007 — Effect authoring contract

Status: accepted, 2026-10-11 (M1).

## Context

M1 had to fix how an effect is declared so that one definition drives types, validation, uniforms, merging, presets, documentation and tests, and so that hundreds of effects stay small and independent.

## Decision

- **One declaration.** `defineEffect({ name, meta, params, presets, sampling, motion, chunks, textures, fragment, setup })` returns a factory. Parameters are declared with `float`, `int`, `bool`, `color`, `vec2`, `vec3` and `select`; each has a default, a range where it applies and a one-sentence description. Instances get a typed property per parameter.
- **`$` namespacing.** Effect GLSL defines `vec4 $main(vec4 color, vec2 uv)` and refers to its own parameters, textures and helper functions as `$name`. The compiler renames them per effect (`e0_`, `e1_` …), so several copies of an effect merge without clashes. Shared code comes from shader chunks via `#include`, deduplicated across the pass.
- **Uniform or structural.** Parameters are uniforms by default; changing one never recompiles. `structural: true` compiles a parameter into a `#define` (for loop counts and code paths); changing it recompiles only the pass containing the effect.
- **Sampling.** `pixel` effects read only their own pixel and merge anywhere. `input` effects sample the pass input elsewhere, or render their own passes from it, so the planner starts a new pass at each one.
- **Multi-pass effects.** `setup(context)` returns resources that render before the merged pass and fill the effect's texture uniforms. The context carries a small kit of three.js classes, so effect modules never import three.js: they stay small, server-safe and tree-shakeable. `@mk7s/xtree/core` is the only entry that imports three.js.
- **Motion.** Each effect declares `static`, `freeze` (time stops) or `{ settle: values }` (still values replace the animated ones without changing the user's settings). With motion off, the composer holds time even if the application sets it.
- **Provenance and docs.** Each effect has a `credits.json` entry, a size budget, presets (at least two), visual baselines, and a page generated from its definition plus an optional hand-written `notes.md`.

## Consequences

The GLSL lint checks every `$name` against the schema and compiles every structural variant and preset (two copies merged) with glslang. Effects can't share mutable GPU state across instances; an effect instance belongs to one composer at a time.
