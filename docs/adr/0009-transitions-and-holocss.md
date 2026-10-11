# 0009 — Transitions and HoloCSS

Status: accepted, 2026-10-11 (M2). Resolves X13.15.

## Context

HoloCSS already ships seven WebGL transitions for its `transition3d()` (dissolve, displacement, ripple, page-curl, mosaic, cube and flip), each a short shader behind its `ThreeEffect` contract: a fragment shader for a `ShaderMaterial` with exactly four uniforms (`fromTexture`, `toTexture`, `progress`, `accent`), an optional vertex shader, a CSS `fallback` from a fixed list, and an optional geometry `kind` (`cube` or `flip`). xtree's plan calls for a larger, parameterized transition catalogue (X13) usable both inside HoloCSS and without it.

## Decision

- **HoloCSS keeps its seven.** They stay in HoloCSS as its zero-dependency defaults: HoloCSS must work without xtree, each shader is about ten lines, and `cube` and `flip` depend on geometry that `transition3d()` builds from `kind`. Nothing moves between the repositories.
- **xtree transitions target the contract, they don't replace it.** `defineTransition()` declares a transition with xtree's parameter schema; `createTransition()` runs it standalone on two textures; `toHoloEffect()` compiles it to a `ThreeEffect`. Because the contract carries no extra uniforms, `toHoloEffect` bakes the current parameter values in as `#define`s (call it again after changing them) and refuses texture parameters.
- **xtree restates the contract.** `HoloThreeEffect` mirrors `ThreeEffect` so xtree has no dependency on HoloCSS. The GPU tests run converted transitions through the real `transition3d()` from the HoloCSS commit pinned in `holocss.json` and compare its pixels with the standalone runtime, so a contract change shows up as a test failure when the pin moves.
- **Overlap is by design.** Where an xtree transition covers a HoloCSS one (crossfade's `noise` pattern and HoloCSS's dissolve), the xtree version is the configurable superset; HoloCSS's stays the default.
- **Geometry transitions wait for the contract.** Shatter and fold (X13.11–12) need new `kind` values in HoloCSS; they are proposed there first.

## Consequences

Each repository owns its shaders and there is no migration. HoloCSS users opt into xtree transitions with one `toHoloEffect()` call. The xtree GPU test job fetches the pinned HoloCSS source, as the docs build already does. A matching note belongs in HoloCSS's own documentation; it can't be written from this repository and is tracked for the HoloCSS side.
