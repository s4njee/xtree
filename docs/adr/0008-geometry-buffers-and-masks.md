# 0008 — Geometry buffers and masks

Status: accepted, 2026-10-11 (M2).

## Context

Depth of field, fog and outlines need the scene's depth and normals. Selective bloom, glow, outlines of chosen objects and "glitch only this" need a per-pixel mask. Both had to fit the merging compiler (ADR 0002) without making every frame pay for buffers no effect reads, and without effect modules importing three.js (ADR 0007).

## Decision

- **Declared buffers.** An effect lists the buffers it reads, `buffers: ['depth', 'normal']`, or picks them from its structural parameters with a function. The composer takes the union over enabled effects each frame. Depth is the scene render's own depth attachment, made a `DepthTexture` only while needed; normals are one extra scene render with `MeshNormalMaterial`. Velocity buffers are deferred until an effect needs them (motion blur, TAA).
- **Header helpers, not chunks.** A pass whose effects need depth gets `xt_depth`, `xt_viewDepth`, `xt_viewPosition` and `xt_worldPosition` in its header, and normals add `xt_viewNormal`. The camera-independent math lives in the `xtree/depth/reconstruct` chunk and matches three.js's `packing` functions. Because the buffers are pass globals, depth effects that only read their own pixel stay `pixel` effects and merge with color effects.
- **Masks on every effect.** `effect.mask` is a texture channel, a depth range or a selection (objects and their descendants, or a layer, optionally x-ray), each invertible. The compiler gives every effect a `$maskAt(uv)` function; by default the mask scales the effect's opacity, and an effect with `masking: 'custom'` reads it itself (outline traces it, selective bloom and glow use it as their source). The mask kind is compiled in; its values are uniforms.
- **Selection prepasses.** Each distinct selection mask is one scene render with white and black `MeshBasicMaterial`s swapped in (or an invisible one for x-ray), restored afterwards. Effects sharing one mask object share the render.
- **Interop.** `EffectPass.setGeometry({ depth, normal, camera })` supplies the buffers when the pass runs in three.js's own `EffectComposer`.

## Consequences

`composer.stats` reports the prepasses and whether depth was kept, and tests check that nothing extra renders unless an enabled effect needs it. Reversed and logarithmic depth buffers are not handled yet. Prepasses swap materials on the scene graph during the frame, so code that inspects materials from inside a render callback sees the replacements. Selection masks follow the scene's visibility and occlusion, but custom shader displacement in user materials isn't reproduced in the mask.
