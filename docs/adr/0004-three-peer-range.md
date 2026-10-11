# 0004 — three.js peer range

Status: accepted, 2026-10-11.

## Context

HoloCSS's `@mk7s/holocss/three` bridge and Holochart both declare `three` as an external peer with the range `>=0.180.0 <0.187.0` (HoloCSS ADR 0006). An application that uses a chart, a HoloCSS stage and xtree effects must resolve one copy of three.js.

## Decision

- `three` is a required peer dependency of `@mk7s/xtree` with the same range, `>=0.180.0 <0.187.0`. It is never bundled.
- Importing any xtree entry in Node loads no DOM. Effect, shader and GLSL entries never load the peer either: a unit test imports them under a resolve hook that fails on any `three` import. `@mk7s/xtree/core` (the composer and passes) is the one entry that imports three.js, and it passes the classes multi-pass effects need to their `setup` (amended in M1; see [ADR 0007](./0007-effect-authoring)).
- The range moves in lockstep with HoloCSS and Holochart. CI will test the lowest and highest versions in the range once effects import three.js (M1).

## Consequences

The core imports from `three` only, never from `three/examples`. The test fixtures use three's example `EffectComposer` to prove interop, but the library never does.
