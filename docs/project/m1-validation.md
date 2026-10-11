# M1 validation

Milestone M1 (vertical slice) covers:

- **Core:** X1.1–X1.4 (parameter schema, uniforms, composer, merging), X1.7 (output stage) and X1.13 (lifecycle), plus X1.5 (multi-pass effects), which bloom needs.
- **Effects:** vignette (X3.4), chromatic aberration (X4.1), bloom (X5.2), RGB split glitch (X6.1) and holographic foil (X11.1).
- **Docs:** X19.3 (HoloCSS theme), X19.7 (demo runtime), X19.9 (generated controls) and X19.15 (generated effect pages).

Exit criteria: five effects done to the [definition of done](https://github.com/s4njee/xtree/blob/main/plan.md#4-definition-of-done-for-an-effect) with generated pages, live controls and visual tests, and merging proven equivalent.

Recorded 2026-10-11 in a Linux container: Node 22.22.0, pnpm 11.15.1, headless Chromium 141 (SwiftShader WebGL2), glslangValidator 15.1.0. Firefox and WebKit run in CI.

## Results

| Check                                      | Result                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check` (with `XT_REQUIRE_GLSLANG=1`) | Pass. Includes the GLSL lint (14 chunks and 5 effects, 27 merged variants compiled with glslang), credits (19 entries), size budgets, the generated-file checks (chunk maps, shader reference, effect pages) and 63 unit tests |
| `pnpm test:browser` (Chromium)             | 110 passed: 78 shader-chunk tests, 25 composer integration tests, 7 visual tests (27 baselines)                                                                                                                                |
| `pnpm test:docs` (Chromium)                | 22 passed: contrast in all 18 HoloCSS themes, every page without console errors, demo controls, navigation, reduced motion                                                                                                     |
| `pnpm release:dry`                         | Pass: every export target and declaration file is in the tarball                                                                                                                                                               |

## Merge equivalence (X1.4c)

Merged and unmerged renders of the same stack are compared in float (rendered into a float target before 8-bit quantization), as CIE76 ΔE of the display-encoded colors:

| Stack                                                                                 | Passes merged / unmerged | ΔE, 99.9th percentile | ΔE, max |
| ------------------------------------------------------------------------------------- | ------------------------ | --------------------- | ------- |
| Five pixel effects (vignettes and holographic foils, with multiply and screen blends) | 1 / 5                    | 0.26                  | 1.23    |
| Bloom, vignette, chromatic aberration, foil, glitch, vignette                         | 3 / 6                    | 0.06                  | 0.09    |

The tests require a 99.9th percentile below 1 and a maximum below 3. The largest differences are at the edge of the scene's HDR orb (emissive intensity 7), where the same arithmetic compiled into different programs rounds differently. Comparing 8-bit output overstates differences near black, where a single level is already about ΔE 1. An earlier run found a real problem here: the screen blend darkened HDR values, so `xt_blendScreen` now clamps its product term.

## Stories

| Story  | Evidence                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1.1   | `float`, `int`, `bool`, `color`, `vec2`, `vec3` and `select`, with inferred types (checked with `expectTypeOf`). Invalid values throw a TypeError or RangeError that names `effect.parameter`, and nothing changes. `texture`, `curve` and `gradient` parameters are deferred until an effect needs them. |
| X1.2   | A float change caused no compile and no new program, while a structural change recompiled only its own pass (`composer.spec.ts`).                                                                                                                                                                         |
| X1.3   | Half-float buffers, MSAA option, DPR cap 2, pixel cap 4 M. A resize reallocates once. `render(delta, target)` can render into a texture.                                                                                                                                                                  |
| X1.4   | Five pixel effects render in one pass. Equivalence is in the table above.                                                                                                                                                                                                                                 |
| X1.5   | `setup` returns resources that render before the merged pass. Bloom's mip chain uses it and its composite merges with the following effects.                                                                                                                                                              |
| X1.7   | An empty stack matches a plain `renderer.render` for all 7 tone mappings × 2 color spaces (99.9% of pixels within 2 levels, on a black background; three.js doesn't tone-map its clear color).                                                                                                            |
| X1.13  | 20 create/render/dispose cycles return textures, geometries and programs to the baseline. The composer skips frames while the context is lost and renders again after restore. Every `dispose()` is idempotent.                                                                                           |
| X1.15  | All five effects, one `EffectPass` each in three.js's own `EffectComposer` with an `OutputPass`, render the same as the xtree composer (under 0.5% of pixels over 2 levels).                                                                                                                              |
| X19.3  | VitePress colors, fonts, buttons, code and search use HoloCSS roles. Text, secondary text and links meet 4.5:1 in all 18 themes (`auto` plus 17 palettes).                                                                                                                                                |
| X19.7  | `<EffectDemo>` lazily loads three.js, the composer and only its own effect. It pauses offscreen, has Pause/Play and follows HoloCSS's motion policy (no autoplay under reduced motion). After 15 client-side navigations exactly one demo is alive and there are no WebGL warnings.                       |
| X19.9  | Controls are generated from the schema with HoloCSS components: sliders with fill, switches, segmented controls or selects, color inputs and vector fieldsets. The demo also has preset buttons, Reset, a before/after split, pointer-driven `tilt` and live code that updates with the controls.         |
| X19.15 | `pnpm effects:docs` generates each effect page (demo, usage, parameters, presets, passes, motion, size budget, credits, related), the catalogue, the sidebar and the demo registry. `--check` runs in `pnpm check`.                                                                                       |

## Definition of done, per effect

All five effects meet items 1–8 and 10. For each one:

1. **Schema:** a full parameter schema.
2. **Size:** its own export and size budget.
3. **Cleanup:** disposal, covered by the lifecycle test.
4. **Merging:** works merged, alone, and in three.js's composer.
5. **Output:** the output stage handles tone mapping and color space.
6. **Motion:** declared behaviour (static, freeze or settle), tested for the foil (freeze) and the glitch (settle).
7. **Presets:** four each.
8. **Visual baselines:** the default and every preset.
9. **GPU timing:** not done (see the gaps below).
10. **Docs:** a generated page.

The RGB split glitch only shifts channels and changes bursts at most 1.5 times a second. The photosensitivity analyser that will check this automatically is X16.3 in M2.

## Known gaps

- **GPU timings (DoD item 9)** are not recorded: they need the reference hardware and the benchmark harness (X17.1–X17.2), which this container can't stand in for. The effect pages show size budgets instead.
- **Visual baselines** come from Chromium. CI compares Firefox and WebKit against the same images with a tolerance (1% of pixels, threshold 0.12); the first CI run on this milestone checks that tolerance.
- **The holographic foil's theme tint** uses a fixed default; binding to HoloCSS's `--hcss-accent` is X15.2 in M2.
- **The docs theme** is not typechecked with `vue-tsc` yet; the docs build and site tests cover it.
