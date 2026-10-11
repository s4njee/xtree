# 0003 — WebGL2 first, WebGPU later

Status: accepted, 2026-10-11.

## Context

three.js supports `WebGLRenderer` and the newer `WebGPURenderer` with TSL node materials. HoloCSS's three.js bridge and Holochart both use WebGL2. WebGPU coverage is still uneven across browsers, and a TSL implementation of every effect would double the work before the catalogue exists.

## Decision

- Target `WebGLRenderer` with a WebGL2 context and GLSL ES 3.00. WebGL1 is out of scope.
- Shader chunks avoid extensions without fallbacks, leave precision to the host shader, use `xt_` names and keep effect logic in plain functions, so a later TSL port (or an IR that emits both) stays possible.
- The X21.1 spike ports five representative effects to TSL before 1.0 and decides the strategy.

## Consequences

Effects can rely on `texelFetch`, integer operations, `floatBitsToUint`, float render targets (`EXT_color_buffer_float`) and multiple render targets. The browser tests run real WebGL2 in Chromium, Firefox and WebKit.
