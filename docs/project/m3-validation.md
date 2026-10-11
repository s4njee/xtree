# M3 validation

Milestone M3 (beta) covers:

- **Effects:** all 70 P1 stories, across color and tone (X3.9–X3.15), lens and camera (X4.6–X4.11), blur and glow (X5.5–X5.9), glitch (X6.5–X6.10), retro (X7.5–X7.10), stylization (X8.4–X8.11), distortion (X9.3–X9.9), atmosphere (X10.2–X10.5), holographic (X11.4–X11.9), materials (X12.4–X12.10) and transitions (X13.3–X13.10). The catalogue now holds 109 effects: 86 post-processing, 14 material and 9 transition.
- **Core:** the velocity and history buffers, `FrameInfo.camera`, `createPassKit` and effect `state` uniforms.
- **Materials (X12.1 complete):** world and object normals, barycentrics, vertex hooks that write normals, and settings computed from values.
- **Animation and interaction:** X14, with a `seed` on every stochastic effect.
- **HoloCSS:** stage and ambient-scene interop, X15.4–X15.6.
- **Performance:** X17.1–X17.5.
- **Docs:** X19.16–X19.29.

Exit criteria: a `0.x-beta` release; docs with the gallery, guides and API reference; and published benchmarks.

Recorded 2026-10-11 in a Linux container with Node 22.22.0, pnpm 11.15.1, headless Chromium 141 (SwiftShader WebGL2) and glslangValidator 15.1.0. Firefox and WebKit run in CI on GitHub Actions (ubuntu-latest).

## Results

| Check                                      | Result                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (with `XT_REQUIRE_GLSLANG=1`) | Pass. The GLSL lint compiles 21 chunks and 109 effects (1,021 merged variants) with glslang. Credits has 130 entries, with all licences allowed and notices present. The export map has 125 entries. Also passing: typecheck, the API reference (undocumented exports are errors), size budgets, generated-file checks and 246 unit tests.                        |
| `pnpm test:browser`                        | 423 passed (1 skipped: the benchmark, which runs only under `pnpm bench`) in Chromium locally. CI runs the same suite in Chromium, Firefox and WebKit, each against its own visual baselines.                                                                                                                                                                     |
| `pnpm test:coverage` (X18.1)               | `src/core` at 96.9% of lines (2,358 of 2,433) in Chromium; the gate is 90%. The effects are at 99.4% (8,794 of 8,843 lines) and `src/holocss` at 99.4%. CI enforces the gate and uploads the report.                                                                                                                                                              |
| `pnpm test:docs`                           | 34 passed. That includes every guide page, the scroll-driven timeline and HoloCSS ambient demos, and the gallery's hover preview, which never plays while motion is off.                                                                                                                                                                                          |
| `pnpm release:dry`                         | `mk7s-xtree-0.1.0-beta.0.tgz`, 451 files, matches the export map.                                                                                                                                                                                                                                                                                                 |
| Benchmarks (X17.2)                         | `pnpm bench` measured all 86 post-processing effects at 960×540 against the studio scene. Results are in `bench/results/ci-swiftshader.json`, and each effect page shows them as a Cost line. The nightly workflow keeps one benchmark artifact per run.                                                                                                          |
| Precompile (X17.5)                         | After `composer.compileAsync()`, the first frame compiles no new programs. The count covers the scene, the merged passes, the materials an effect's setup creates and the geometry prepasses.                                                                                                                                                                     |
| Adaptive quality (X17.3)                   | Unit tests run the governor against a synthetic GPU cost model, with and without vsync, and it holds within 10% of the target. In the browser, an impossible target drives the composer to half resolution and the `low` tier; lifting the target restores full resolution and the effect's own values. `quality: 'high'` pins an effect while the governor runs. |
| Half resolution (X17.4)                    | SSAO, volumetric fog and depth of field each cost under 60% of their full-resolution cost. Against full resolution, SSAO and fog differ by under 1% mean and 10% at the 99th percentile; depth of field by under 2% and 30%.                                                                                                                                      |

## Safety

- **Photosensitivity.** Every new animated effect, preset and transition passes the WCAG 2.3.1 flash analyser. Transitions are checked over a full one-second run. Effects and presets that failed were changed:
  - Signal loss now changes at most twice a second.
  - The HUD grid's sweep lights only the grid lines.
  - Burn draws a thin edge, and the order it burns in is equalized.
  - The glitch cut uses three steps.
  - The pixelate transition uses nested power-of-two levels.
  - The sort wipe sorts each line once.
  - The holo sweep tints at the image's own brightness.
  - The crossfade iris and wipe have narrower glows.
- **Motion off.** Every new effect renders identical frames while playing with motion off. That includes the effects that read earlier frames (LCD persistence and datamosh), which hold while no time passes.
- **Endpoints.** Every transition is exactly the "from" image at progress 0 and the "to" image at 1, in all three browsers. Firefox and WebKit (Mesa) first showed two driver differences that Chromium hides:
  - `sin(π)` came out slightly negative, and `pow()` of a negative number is undefined, which broke the pixelate transition's last frame.
  - `smoothstep()` with equal edges is undefined, which made the `cut` preset flash.

  Both are now guarded.

- **Seeds (X14.7).** The same seed renders the same frames, and another seed renders a different pattern. A unit test fails if a stochastic effect has no `seed`. Blurs whose only randomness is sample jitter are exempt.

## Known gaps and deferrals

- **X17.1 hardware matrix.** The only results are from this container's software renderer. The laptop iGPU, desktop GPU, Android and iPhone runs need real hardware. The harness (`pnpm bench --out`) and the per-effect Cost line are ready for those results.
- **X17.4 checkerboard rendering.** Not built. Half resolution with depth-aware upsampling meets the cost and difference targets on its own.
- **X15.6 Holochart showcase.** Holochart's source isn't in the pinned HoloCSS checkout, so there is no chart canvas to apply effects to. The "data-viz polish" recipe (X19.29) uses a generic chart scene and says the showcase is planned.
- **X19.17 hover previews.** Hovering a gallery card plays its effect live on one shared renderer instead of a recorded video loop.
- **Benchmarks for materials and transitions.** The benchmarks cover post-processing effects only.
- **Thumbnail cache.** The manifest is gitignored, so a clean checkout copies every thumbnail once.
- **Coverage.** Measured from the browser tests in Chromium only, as in M2.
- **HoloCSS packaging.** Unchanged from M2: HoloCSS is an optional peer that isn't on npm.
