# @mk7s/xtree

## 0.1.0-beta.0

### Minor Changes

- acc9df5: M3 (P1 catalogue): 70 more effects across color, lens, blur, glitch, retro, stylization, distortion, atmosphere, holographic, materials and transitions; the velocity buffer and `FrameInfo.camera` for effects' own passes; `createPassKit`; effect `state` uniforms; material patching with world and object normals, barycentrics, vertex hooks that write normals, and settings computed from values; `@mk7s/xtree/animation` (CSS easing, `animate`, timelines, pointer, orientation, audio and scroll bindings); a `seed` on every stochastic effect; HoloCSS stage and ambient-scene interop (`stageEffects`, `withEffects`); `composer.compileAsync()`, `composer.setAdaptive()` with per-effect `quality` tiers and `resolutionScale`; half-resolution depth of field with depth-aware upsampling; and the `pnpm bench` harness.

  Breaking (alpha): parameters renamed where they collided with new effect-level names. Depth of field's `quality` is now `density`, JPEG's `quality` is now `jpegQuality`, and the crossfade `iris` preset's edge glow is 0.6 (from 1.2) to stay within WCAG 2.3.1.

## 0.1.0-alpha.0

### Minor Changes

- 51666ee: M0 foundation: GLSL include resolution with chunk-relative error mapping, and tested shader chunks for noise (hash, value, gradient, simplex, Worley, fBm, curl, dither), color (sRGB, HSV, HSL, OKLab, OKLCH, YIQ, YUV, luminance, white balance, tone mapping) and 26 blend modes.
- caf92d5: M1 vertical slice: `defineEffect` and the parameter schema DSL, the `EffectComposer` (merged passes, half-float HDR buffers, DPR and pixel caps, an output stage that applies tone mapping and color space once, motion policy, render-to-target, context-loss recovery), `EffectPass` for three.js's own composer, per-chunk shader maps, and five effects: vignette, chromatic aberration, bloom, RGB split glitch and holographic foil. The screen blend mode no longer darkens HDR values.
- M2 alpha: all 37 P0 effects (color and tone, lens and camera, blur and glow, glitch, retro, stylization, distortion, depth fog, holographic, materials and the crossfade transition) plus a buffer view and a foil material. Geometry buffers (depth, normals) and masks (texture, depth range, object selection with x-ray). Material effects through `patchMaterial`, and transitions through `createTransition` and `toHoloEffect` for HoloCSS's `transition3d()`. Composer `play()`/`pause()` (no autoplay), `progress` and `drive()`, pointer, scroll and audio inputs, GPU timing, `describe()` and a debug overlay. Stack serialization. New entries: `@mk7s/xtree/motion` (the HoloCSS motion policy without HoloCSS), `@mk7s/xtree/safety` (a WCAG 2.3.1 flash analyser) and `@mk7s/xtree/holocss` (theme roles with `bindTheme` and HoloCSS's motion policy with `bindMotion`; HoloCSS is an optional peer). Shader chunks for sampling, SDF shapes, ordered dithering, depth reconstruction and spectral color. Disabling a three.js pass in the stack now takes effect.
