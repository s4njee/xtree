---
'@mk7s/xtree': minor
---

M3 (P1 catalogue): 70 more effects across color, lens, blur, glitch, retro, stylization, distortion, atmosphere, holographic, materials and transitions; the velocity buffer and `FrameInfo.camera` for effects' own passes; `createPassKit`; effect `state` uniforms; material patching with world and object normals, barycentrics, vertex hooks that write normals, and settings computed from values; `@mk7s/xtree/animation` (CSS easing, `animate`, timelines, pointer, orientation, audio and scroll bindings); a `seed` on every stochastic effect; HoloCSS stage and ambient-scene interop (`stageEffects`, `withEffects`); `composer.compileAsync()`, `composer.setAdaptive()` with per-effect `quality` tiers and `resolutionScale`; half-resolution depth of field with depth-aware upsampling; and the `pnpm bench` harness.

Breaking (alpha): parameters renamed where they collided with new effect-level names. Depth of field's `quality` is now `density`, JPEG's `quality` is now `jpegQuality`, and the crossfade `iris` preset's edge glow is 0.6 (from 1.2) to stay within WCAG 2.3.1.
