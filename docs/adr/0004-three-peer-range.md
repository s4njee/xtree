# 0004 — three.js peer range

Status: accepted, 2026-10-11.

## Context

HoloCSS's `@mk7s/holocss/three` bridge and Holochart both declare `three` as an external peer with the range `>=0.180.0 <0.187.0` (HoloCSS ADR 0006). An application that uses a chart, a HoloCSS stage and xtree effects must resolve one copy of three.js.

## Decision

- `three` is a required peer dependency of `@mk7s/xtree` with the same range, `>=0.180.0 <0.187.0`. It is never bundled.
- Importing any xtree entry in Node loads neither a DOM nor the peer. A unit test runs every export under a resolve hook that fails on any `three` import.
- The range moves in lockstep with HoloCSS and Holochart. CI will test the lowest and highest versions in the range once effects import three.js (M1).

## Consequences

The M0 entries (shader chunks and GLSL utilities) don't import three.js at all. From M1, effect entries import three.js types and classes only from `three`, never from `three/examples`, unless an ADR records the exception.
