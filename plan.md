# xtree — three.js Effects Library

**Status:** Planning. No code yet
**Created:** 2026-10-11
**Working package name:** `@mk7s/xtree` (check the name is free on npm before release)
**Purpose:** A large, reusable, tree-shakeable set of three.js effects: post-processing, materials and transitions. It has a VitePress documentation site that uses the [HoloCSS](https://github.com/s4njee/holocss) design system.

## 1. Product direction

three.js ships a few post-processing passes in `three/examples/jsm/postprocessing` (glitch, RGB shift, bloom, film, halftone, and so on). They are examples, not a library. Each one is a separate full-screen pass, parameters are unvalidated uniforms, nobody tracks disposal, there is no motion or photosensitivity policy, and the docs are a single demo page. xtree turns that idea into a product:

- **A large catalogue** of effects in a few families: color, lens, glow, glitch, retro display, stylization, distortion, atmosphere, holographic, materials and transitions.
- **Composable by default.** Compatible screen-space effects merge into one shader pass. Effects that blur or sample neighbouring pixels get their own passes only where they need them.
- **Typed and self-describing.** Every effect declares a parameter schema: type, range, default, unit and group. That one schema drives TypeScript types, runtime validation, presets, serialization and the docs controls.
- **Safe by default.** Effects respect reduced motion and high contrast, and anything that flashes is capped below WCAG 2.3.1's three-flashes threshold by default.
- **Documented by running it.** Every effect has a live, adjustable demo, a before/after comparison, copyable code that stays in sync with the controls, and a generated API reference. The docs site is VitePress, themed with HoloCSS.

### Goals

- Ship at least 100 effects by 1.0 (141 are planned below). The 37 P0 effects make up the alpha.
- One import per effect (`@mk7s/xtree/effects/bloom`) so unused shaders never reach the bundle. Each entry has its own size budget.
- Zero runtime dependencies beyond the `three` peer. Use the same peer range as HoloCSS and Holochart (`>=0.180.0 <0.187.0`, revisited for each three.js release).
- Work with stock `WebGLRenderer` scenes and with the HoloCSS `@mk7s/holocss/three` bridge, its shared stage and its transition contract.
- Pick up HoloCSS theme roles (`--hcss-accent`, `--hcss-surface`, `--hcss-text`, …) and the HoloCSS motion policy without a hard dependency on HoloCSS.
- Visual regression tests for every effect in Chromium, Firefox and WebKit.
- Hold 60 fps on a mid-range laptop iGPU at 1080p for the documented "typical stack", with adaptive quality on mobile.

### Non-goals (initially)

- A general scene graph, physics, or asset pipeline. xtree applies effects to a scene; it does not build scenes.
- Simulation-heavy systems: GPU particles, fluids, cloth. These may come later as a separate package.
- Full path tracing or production-grade SSR/SSGI. A basic SSR is a stretch story only.
- Supporting `WebGLRenderer` WebGL1 contexts. WebGL2 is required, matching HoloCSS's `createStage`.
- WebGPU/TSL parity before 1.0. It is a planned post-1.0 epic (X21), but the architecture must not block it.

## 2. Existing project context

`xtree` is an empty repository. The design reference is the sibling project **HoloCSS** (`s4njee/holocss`, `@mk7s/holocss` 0.1.0-alpha.0, unpublished). Relevant findings from a read of its `README.md`, `plan.md`, `docs/3d-guide.md`, `docs/docs-site.md`, `docs/themes-guide.md`, `docs/runtime-guide.md` and `docs/adr/0006-three-entry-point.md`:

| HoloCSS fact | Consequence for xtree |
| --- | --- |
| Uses pnpm (11.x), TypeScript, Vite, Vitest, Playwright and ESM. Docs examples double as browser regression fixtures. Requires Node ≥ 22.12. | Use the same toolchain and conventions. Docs demos double as visual test fixtures. |
| Optional `@mk7s/holocss/three` bridge: one detached `WebGLRenderer` per document; stages created with `createStage()`, `own()` and `destroy()`; three is a lazily imported external peer `>=0.180.0 <0.187.0`. | xtree uses three as an external peer with the same range. It must be able to render into a HoloCSS `Stage` without creating a second WebGL context. |
| Seven transition shaders already exist (`dissolve`, `displacement`, `ripple`, `page-curl`, `mosaic`, `cube`, `flip`) behind a `ThreeEffect { name, fallback, fragment, vertex?, kind? }` contract, with `progress`, `fromTexture`, `toTexture` and accent uniforms. | xtree's transition family (X13) should implement the same contract so `transition3d()` can use xtree transitions. Don't fork the seven existing ones. Agree with HoloCSS on who owns them (§9, open question 2). |
| `motionAllowed(element)` / `watchMotion(element, cb)` turn motion off for OS reduced motion, `data-hcss-motion="none"`, and high contrast. Effects "do not periodically blink or regenerate noise". | xtree's motion policy (X16) copies this rule and these attribute names. If HoloCSS is present, xtree calls HoloCSS's functions instead of its own copy. |
| `sceneColors(element)` resolves `--hcss-accent`, `--hcss-surface` and `--hcss-text` (any CSS color syntax) to sRGB hex values. Seventeen built-in themes (shadcn, md7-*, Ceres, Glass, high-contrast, …), plus `auto`. | Theme-aware effects such as the holographic tints, outline colors and gradient maps take colors from theme roles. The docs site exposes every HoloCSS theme. |
| Docs are a Vite multi-page site, generated from manifests, deployed to `mk7s.dev/holocss/`. Components follow a "demo + import + markup + variants + tokens + previous/next" page pattern. | xtree uses VitePress (the user asked for it) but copies the page anatomy and manifest-driven generation. It could deploy to `mk7s.dev/xtree/`. |
| Has a size budget per entry (`scripts/size.mjs`), ADRs in `docs/adr/`, a validation record per milestone, and a `pnpm check` gate. | Copy all three: size budgets, ADRs, and a single `pnpm check` gate. |

## 3. Architecture (decisions to confirm in ADRs during X0)

### 3.1 Effect kinds

| Kind | What it is | Example | Runs as |
| --- | --- | --- | --- |
| **Post effect** | Screen-space operation on the rendered frame (color plus optional depth, normal and velocity) | Vignette, chromatic aberration, ASCII | GLSL function `vec4 mainImage(vec4 inputColor, vec2 uv, …)`, merged into one pass |
| **Pass effect** | A post effect that needs several passes, mip chains or neighbour sampling | Bloom, depth of field, SSAO, Kuwahara | One or more dedicated passes plus an optional merged composite step |
| **Material effect** | Changes surface shading through a `ShaderMaterial` or a three.js `onBeforeCompile` patch | Hologram, iridescence, dissolve, fresnel rim | Material factory or `patchMaterial(mat, effect)` |
| **Transition** | Blends A to B with `progress ∈ [0,1]` | Dissolve, glitch cut, pixel sort wipe | Full-screen pass with two textures. Uses the HoloCSS `ThreeEffect` contract |

### 3.2 Core runtime

- **`EffectComposer`** (xtree's own, not the one in three/examples): it manages render targets (half-float by default), a shared depth texture, optional normal and velocity prepasses, DPR and resize, and output color-space conversion and tone mapping, which happen once at the end.
- **Effect merging:** consecutive merge-compatible post effects are compiled into one fragment shader. Each effect's uniforms and functions are namespaced (`e3_intensity`). The pipeline gets recompiled only when the effect list changes, never when parameters change. This is the approach of pmndrs/postprocessing, built from scratch. pmndrs/postprocessing is not a dependency, and ADR 0002 records why.
- **Interop:** every xtree pass also implements three's `Pass` interface (`render(renderer, writeBuffer, readBuffer)`), so it works inside an existing `three/examples` `EffectComposer`.
- **Parameter schema:** `defineEffect({ name, params: { intensity: float({ min: 0, max: 1, default: 0.5 }) … }, shader, passes? })`. From that one declaration xtree derives typed options, setters, validation, `toJSON()`/`fromJSON()`, presets and the docs UI.
- **Blend and mask:** every post effect gets `blend` (normal, add, screen, multiply, overlay, soft light, …), `opacity`, and an optional `mask` (texture, depth range, or a selection layer).
- **Time and input:** a clock interface with `time`, `delta` and `progress`. It can be driven by `requestAnimationFrame`, by an external timeline (GSAP, anime.js, a HoloCSS `driveProgress` source), or frozen. Pointer, scroll and audio values are shared uniforms that effects opt into.
- **Ownership:** composers and effects have idempotent `dispose()`. Every GPU resource they create is tracked. Context loss is handled the way HoloCSS stages handle it.
- **Renderer target:** WebGL2 and GLSL ES 3.0 first. Shader sources are written in a form that can later be ported to TSL/WebGPU (no WebGL-only extensions without a fallback). ADR 0003 records this.

### 3.3 Package layout

```
xtree/
  packages/xtree/            # @mk7s/xtree — the library
    src/core/                # composer, defineEffect, schema, merging, buffers, clock
    src/shaders/             # GLSL chunk library (noise, color, blend, sdf, sampling…)
    src/effects/<id>/        # one folder per effect: index.ts, shader.glsl, presets.ts, meta.ts
    src/materials/<id>/
    src/transitions/<id>/
    src/integrations/        # holocss, react-three-fiber (later)
  docs/                      # VitePress site (workspace package, private)
    .vitepress/theme/        # HoloCSS-based theme
    effects/<id>.md          # generated from effect metadata + hand-written notes
  tests/                     # unit, shader compile, visual regression, perf
  docs/adr/                  # architecture decision records (or /adr at root)
```

Use a pnpm workspace with two packages: the library and the docs site. HoloCSS is a single package, but VitePress's dependencies should stay out of the library's lockfile surface. Exports look like `@mk7s/xtree`, `@mk7s/xtree/core`, `@mk7s/xtree/effects/<id>`, `@mk7s/xtree/materials/<id>`, `@mk7s/xtree/transitions/<id>` and `@mk7s/xtree/holocss`.

## 4. Definition of Done for an effect

Every story that adds an effect must meet all of the following. The effect tables below don't repeat it.

1. It is declared with `defineEffect` and its full parameter schema: ranges, defaults, units, groups and a one-line description per parameter.
2. It has its own subpath export and its own gzip size budget in `scripts/size.mjs`.
3. It disposes everything it creates (checked by the leak test in X18), and `dispose()` is idempotent.
4. It works merged with other effects, in isolation, and inside the stock three/examples `EffectComposer`.
5. It works in linear and sRGB output and with each tone-mapping mode, or documents which ones it requires.
6. Motion behavior: animated parameters freeze, or settle to a defined still state, when motion is off. Flashing effects pass the photosensitivity check in X16.
7. It has 2–5 named presets, for example `glitch.presets.subtle` and `glitch.presets.broadcast`.
8. It has visual regression baselines (default plus each preset) in Chromium, Firefox and WebKit.
9. It has a GPU timing measurement at 1080p on the reference machines, recorded in the effect's metadata.
10. It has a docs page (generated) with a live demo, controls, before/after slider, code, presets, performance notes, related effects and credits/licence for any ported technique.

## 5. Effect catalogue overview

Priorities: **P0** = alpha / MVP, **P1** = beta / comprehensive, **P2** = 1.0 or later. Buffers: C = color, D = depth, N = normals, V = velocity.

| Family (epic) | P0 | P1 | P2 | Total |
| --- | --- | --- | --- | --- |
| Color & tone (X3) | 8 | 7 | 3 | 18 |
| Lens & camera (X4) | 5 | 6 | 3 | 14 |
| Blur & glow (X5) | 4 | 5 | 2 | 11 |
| Glitch & signal (X6) | 4 | 6 | 3 | 13 |
| Retro & display (X7) | 4 | 6 | 2 | 12 |
| Stylization & NPR (X8) | 3 | 8 | 4 | 15 |
| Distortion & warp (X9) | 2 | 7 | 3 | 12 |
| Atmosphere & lighting (X10) | 1 | 4 | 4 | 9 |
| Holographic & iridescent (X11) | 3 | 6 | 2 | 11 |
| Material effects (X12) | 2 | 7 | 4 | 13 |
| Transitions (X13) | 1 | 8 | 4 | 13 |
| **Total** | **37** | **70** | **34** | **141** |

---

## 6. Epics and stories

Story IDs are `X<epic>.<n>`. Sizes: **S** ≤ 1 day, **M** 2–3 days, **L** about a week, **XL** needs splitting before work starts.

### X0 — Project foundation

**Goal:** a repository that builds, tests, lints, measures size and publishes a docs preview before any effect exists.

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X0.1 | Initialize the pnpm workspace (`packages/xtree`, `docs`) with TypeScript strict, ESM only, and Node ≥ 22.12, matching HoloCSS. | `pnpm install --frozen-lockfile` works. `packageManager` is pinned. `.npmrc`, `.gitignore` and Prettier config match HoloCSS conventions. | S |
| X0.2 | Library build with Vite library mode (or tsup), one entry per subpath, `three` external, `.d.ts` output. | `pnpm build` emits `dist/` with an entry per export. Importing in Node loads neither a DOM nor the three peer, the same guarantee HoloCSS ADR 0006 makes. | M |
| X0.3 | GLSL handling: `.glsl` imports with an `#include` resolver for the chunk library, minification in production builds, and line-number mapping for compile errors. | A broken shader reports `effect/file.glsl:LINE` in the error. Production shaders are minified and their size is counted in the budgets. | M |
| X0.4 | Lint and format: ESLint (typescript-eslint), Prettier, and a GLSL linter or `glslangValidator` step. | `pnpm lint` and `pnpm format:check` pass and run in CI. | S |
| X0.5 | Vitest unit setup plus Playwright with Chromium, Firefox and WebKit. Use the container's preinstalled Chromium path where present. | `pnpm test` and `pnpm test:browser` each run one sample test. | S |
| X0.6 | `pnpm check`: one gate that runs format, lint, typecheck, build, size, generated-docs freshness and tests. | CI runs `pnpm check` on every push and PR. | S |
| X0.7 | Size budgets: `scripts/size.mjs` with a per-entry gzip ceiling. It excludes the three peer and reports the dependency closure. | CI fails if a budget is exceeded. Writes `artifacts/size.json`. | S |
| X0.8 | ADRs `docs/adr/0001`–`0006`: package layout, composer and merging, WebGL2 versus WebGPU, three peer range, HoloCSS relationship, licensing and credits policy for ported shaders. | Each ADR has status, context, decision and consequences. | M |
| X0.9 | Licensing: MIT for xtree. A `THIRD_PARTY_NOTICES` process for techniques ported from three/examples (MIT), Shadertoy (often CC BY-NC-SA, which can't be used directly), papers, and so on. | A CI script checks that every effect's `meta.credits` names a licence that the allow-list permits. | M |
| X0.10 | CI on GitHub Actions: install, check, browser tests (matrix), docs build, and a preview deploy for PRs. | Green on the `main` branch. Artifacts include the size report and Playwright traces on failure. | M |
| X0.11 | Release tooling: Changesets, `CHANGELOG.md`, a `0.x` prerelease channel, and `private: true` kept on until X22. | `pnpm changeset` works. Release dry run produces a tarball. | S |

### X1 — Core runtime

**Goal:** a composer and effect API that every later epic builds on.

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X1.1 | `defineEffect()` and the parameter schema DSL: `float`, `int`, `bool`, `color`, `vec2`, `vec3`, `enum`, `texture`, `curve`, `gradient`, with min/max/step/default/unit/group/description. | The types infer the options object. Invalid values throw a `TypeError` that names the parameter. Unit tests cover every parameter type. | L |
| X1.2 | Uniform binding: parameter setters update uniforms without a recompile. Colors convert to linear. Defines (structural parameters such as `samples` or `mode`) trigger a scoped recompile. | Changing a float causes zero program compiles (checked through `renderer.info.programs`). Changing an enum recompiles only the affected pass. | M |
| X1.3 | `EffectComposer`: render targets, ping-pong buffers, half-float default, MSAA option, DPR cap (default 2), max pixel cap (default 4 MP, matching HoloCSS), and resize handling. | Resizing reallocates the targets once. The DPR and pixel caps are honored. Works with `renderer.setAnimationLoop`. | L |
| X1.4 | Effect merging compiler: concatenates compatible effects into a single fragment shader, namespacing their uniforms and functions, and handling shared buffer reads. | Five merged color effects produce one draw call. Its output matches running the same five unmerged to within ΔE < 1. | XL → split: X1.4a namespacing, X1.4b codegen, X1.4c equivalence tests |
| X1.5 | Pass effects: an API for multi-pass effects (custom targets, mip chains, downsample/upsample) that can expose a final merged "composite" function. | Bloom (X5.2) is implemented with this API and merges its composite step with color effects. | L |
| X1.6 | Geometry buffers: a shared depth texture, an optional normal prepass, and an optional velocity buffer (with previous-frame matrices). Effects declare what they need, and only those prepasses run. | No prepass runs unless an active effect needs it. There is a debug view for each buffer. | L |
| X1.7 | Output stage: tone mapping (none, linear, Reinhard, Cineon, ACES, AgX, Neutral), exposure, color space conversion, and optional dithering against banding, all applied exactly once. | No double tone mapping (a test compares against a plain `renderer.render` reference). | M |
| X1.8 | Blend modes and opacity per effect, via a GLSL blend chunk with 16+ modes. | A visual test grid shows every mode. | M |
| X1.9 | Masking: texture mask, depth-range mask, and a selection mask that renders listed objects or layers to a mask target. | The outline, selective bloom and selective glitch demos work. | L |
| X1.10 | Clock and drivers: `time`, `delta` and `progress` uniforms. Drivers can be rAF, manual, external (`subscribe(progress)`), or frozen. | A GSAP tween can drive progress, and so can a HoloCSS `scrollProgress()` source (tested with a mock). | M |
| X1.11 | Interaction uniforms: normalized pointer position, pointer velocity, scroll, and an optional audio analyser (FFT bands, level). | Pointer coordinates stay correct when the canvas is offset or scaled. Audio is opt-in and resumes the `AudioContext` only after a user gesture. | M |
| X1.12 | Serialization and presets: `effect.toJSON()`, `EffectStack.fromJSON()`, a preset registry, and URL-safe encoding (used by the docs playground). | A round trip produces identical uniforms. Unknown keys warn and are ignored. | M |
| X1.13 | Lifecycle: `dispose()` everywhere, resource tracking, `webglcontextlost`/`restored` handling, and `AbortSignal` support on async setup. | The leak test (X18.4) passes after 1,000 create/dispose cycles. | M |
| X1.14 | Debug tooling: a pass inspector (list, timings via `EXT_disjoint_timer_query_webgl2` when available, buffer views) and a shader source dump. | `composer.debug()` overlay works in the docs playground. | M |
| X1.15 | `three/examples` interop: an xtree pass can be added to a stock `EffectComposer`, and a three/examples pass can be wrapped as an xtree pass. | Both directions are covered by a test. | S |

### X2 — Shader chunk library

**Goal:** shared, tested GLSL building blocks so effects stay small and consistent.

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X2.1 | Hashing and noise: hash 1–3D, value, Perlin, simplex 2D/3D/4D, Worley/cellular, FBM, curl noise, blue-noise texture sampling. | Each function has a GLSL unit harness test (render to a 1×N target and read pixels back). | L |
| X2.2 | Color: sRGB/linear, HSV/HSL, OKLab/OKLCH, luminance (Rec.709), YIQ/YUV, temperature and tint, ACES/AgX helpers. | Round-trip error is below 1e-4 on the test vectors. | M |
| X2.3 | Blend modes, the 16+ Photoshop-style modes. | Matches a reference CPU implementation. | S |
| X2.4 | Sampling: bicubic, Catmull-Rom, Kawase/dual filter, Poisson disk, golden-angle spiral, 9-tap and 13-tap downsampling. | Used by X5 without duplication. | M |
| X2.5 | SDF and geometry: 2D primitives, smooth min, rotations, polar and log-polar coordinates. | Used by the transitions and kaleidoscope. | S |
| X2.6 | Dithering matrices (Bayer 2/4/8, blue noise) and palette quantization helpers. | Shared by X7. | S |
| X2.7 | Depth helpers: linearize, view-position reconstruction, and normal reconstruction from depth. | Matches three's `packing` and `perspectiveDepthToViewZ`. | S |
| X2.8 | Thin-film interference and spectral helpers (wavelength to RGB, dispersion). | Feeds X11. Checked against reference curves. | M |

### X3 — Color & tone

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X3.1 | Brightness / Contrast / Saturation | brightness, contrast, saturation, vibrance | C | P0 | S |
| X3.2 | Hue / Saturation / Lightness | hue shift, saturation, lightness, colorize | C | P0 | S |
| X3.3 | Exposure & Gamma | exposure (EV), gamma, offset | C | P0 | S |
| X3.4 | Vignette | offset, darkness, roundness, smoothness, color, mode (eskil/classic) | C | P0 | S |
| X3.5 | LUT color grading (3D LUT) | `.cube`/`.3dl` loader, strip PNG, intensity, tetrahedral interpolation | C | P0 | M |
| X3.6 | Sepia / Grayscale / Duotone | mode, amount, shadow and highlight colors | C | P0 | S |
| X3.7 | Gradient map | gradient stops (from theme roles by default), amount | C | P0 | S |
| X3.8 | Invert / Threshold | invert, threshold, smoothness, per-channel | C | P0 | S |
| X3.9 | Levels | input black/white, gamma, output black/white, per-channel | C | P1 | S |
| X3.10 | Curves | master and RGB curves (baked to a 1D texture) | C | P1 | M |
| X3.11 | White balance | temperature, tint | C | P1 | S |
| X3.12 | Color balance (lift/gamma/gain) | shadows, midtones, highlights wheels | C | P1 | M |
| X3.13 | Channel mixer | 3×3 matrix and presets (swap, mono) | C | P1 | S |
| X3.14 | Split toning | shadow and highlight hue, balance | C | P1 | S |
| X3.15 | Bleach bypass / Cross process | amount, look presets | C | P1 | S |
| X3.16 | Auto exposure (eye adaptation) | min/max EV, speed up/down, metering (average, center, spot) | C (histogram/mip) | P2 | L |
| X3.17 | Histogram & scopes (debug) | waveform, vectorscope, histogram overlay | C | P2 | M |
| X3.18 | Palette match (theme-aware) | palette (HoloCSS theme roles or custom), distance metric (OKLab), dither | C | P2 | M |

### X4 — Lens & camera

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X4.1 | Chromatic aberration | offset, radial falloff, samples (spectral mode), direction | C | P0 | S |
| X4.2 | Film grain | intensity, size, luminance response, animated (motion-aware) | C | P0 | S |
| X4.3 | Lens distortion | barrel/pincushion k1/k2, scale, edge handling | C | P0 | S |
| X4.4 | Depth of field (bokeh) | focus distance/range, aperture, bokeh shape (circle, hexagon), quality | C D | P0 | L |
| X4.5 | Tilt-shift | focus band, angle, blur amount | C | P0 | M |
| X4.6 | Lens flare | ghosts, halo, starburst, dirt texture, threshold | C | P1 | L |
| X4.7 | Anamorphic streaks | threshold, length, tint, count | C | P1 | M |
| X4.8 | Motion blur (camera + object) | intensity, samples, max velocity | C V | P1 | L |
| X4.9 | Halation | threshold, radius, red tint | C | P1 | M |
| X4.10 | Lens dirt | texture, intensity tied to bloom | C | P1 | S |
| X4.11 | Fisheye / panini projection | strength, crop | C | P1 | M |
| X4.12 | Rolling shutter | skew amount, direction, uses velocity | C V | P2 | M |
| X4.13 | Physically based camera | f-stop, shutter, ISO mapped to DoF, motion blur and grain | — | P2 | M |
| X4.14 | Sensor noise & hot pixels | read noise, shot noise, hot pixel density | C | P2 | S |

### X5 — Blur & glow

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X5.1 | Gaussian / Kawase / box blur | radius, iterations, kernel | C | P0 | M |
| X5.2 | Bloom (mip chain, physically based) | threshold, knee, intensity, radius, levels, tint | C | P0 | L |
| X5.3 | Selective bloom | selection (layers/objects), luminance mode | C + mask | P0 | M |
| X5.4 | Glow / outer glow | color, radius, intensity, selection | C + mask | P0 | M |
| X5.5 | Radial / zoom blur | center (pointer-able), strength, samples | C | P1 | S |
| X5.6 | Directional / motion-streak blur | angle, length | C | P1 | S |
| X5.7 | Bokeh blur (2D, no depth) | radius, shape | C | P1 | M |
| X5.8 | Frosted glass / backdrop blur | blur, noise, tint (matches the HoloCSS Glass theme) | C + mask | P1 | M |
| X5.9 | Light streaks (star filter) | count, angle, length, threshold | C | P1 | M |
| X5.10 | Temporal accumulation (TAA-lite) | feedback, jitter, clamp | C V | P2 | L |
| X5.11 | Kawase dual-filter glare | iterations, offset | C | P2 | S |

### X6 — Glitch & signal

Every story in this epic must pass the photosensitivity check (X16.3) by default. Presets that exceed it are labelled "unsafe" and are disabled while motion is off.

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X6.1 | RGB split glitch | amount, angle, jitter, trigger (auto, manual, pointer) | C | P0 | S |
| X6.2 | Block displacement glitch | block size, density, strength, color shift, seed | C | P0 | M |
| X6.3 | Scanline tear / horizontal jitter | line height, offset, frequency | C | P0 | S |
| X6.4 | Digital noise / static | amount, color/mono, blend | C | P0 | S |
| X6.5 | Datamosh (P-frame smear) | decay, motion source (velocity or optical-flow-lite), keyframe interval | C V + history | P1 | L |
| X6.6 | Pixel sorting | threshold low/high, direction, sort key (luma, hue), span length | C | P1 | L |
| X6.7 | JPEG / compression artifacts | quality, block size, chroma subsampling | C | P1 | M |
| X6.8 | Bit crush / color depth | bits per channel, dither | C | P1 | S |
| X6.9 | Slice shift | slices, max offset, direction | C | P1 | S |
| X6.10 | Signal loss / dropout | frequency, duration, freeze-frame | C + history | P1 | M |
| X6.11 | Glitch sequencer | timeline of glitch bursts with seeded randomness and an intensity envelope | — | P2 | M |
| X6.12 | Corrupted text / glyph overlay | glyph atlas, density | C | P2 | M |
| X6.13 | Interlace / field doubling | field offset, comb strength | C | P2 | S |

### X7 — Retro & display emulation

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X7.1 | Pixelate | pixel size, shape (square, hex, circle), grid | C | P0 | S |
| X7.2 | Ordered / blue-noise dithering | matrix, levels, palette, scale | C | P0 | M |
| X7.3 | Scanlines | density, intensity, scroll speed | C | P0 | S |
| X7.4 | CRT | curvature, mask (aperture/slot/shadow), bloom, vignette, flicker (motion-aware) | C | P0 | L |
| X7.5 | VHS | tracking noise, chroma bleed, head-switching, tape wobble, date stamp | C | P1 | L |
| X7.6 | Palette reduction | built-in palettes (Game Boy, CGA, EGA, PICO-8, C64, NES), custom, dither | C | P1 | M |
| X7.7 | LCD / subpixel grid | subpixel layout, gap, persistence | C | P1 | M |
| X7.8 | Error-diffusion style dither (approximate) | Floyd-Steinberg / Atkinson approximation, threshold | C | P1 | M |
| X7.9 | Teletext / 1-bit | resolution, palette | C | P1 | S |
| X7.10 | NTSC composite | dot crawl, artifact colors, sharpness | C | P1 | L |
| X7.11 | Oscilloscope / vector display | phosphor decay, beam width | C + history | P2 | L |
| X7.12 | Thermal / night vision | palette, noise, bloom, scope mask | C | P2 | S |

### X8 — Stylization & non-photorealistic rendering

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X8.1 | Outline (depth + normal edge detection) | thickness, depth/normal thresholds, color (theme accent), selection | C D N | P0 | M |
| X8.2 | Halftone / dot screen | shape (dot, line, square), angle per channel (CMYK), scale | C | P0 | M |
| X8.3 | ASCII | charset, cell size, color mode (mono, original, theme), font atlas | C | P0 | M |
| X8.4 | Sobel / Canny edges (image) | threshold, color, overlay mode | C | P1 | S |
| X8.5 | Toon posterize (screen) | bands, edge darkening | C | P1 | S |
| X8.6 | Kuwahara (painterly) | radius, sectors (anisotropic variant) | C | P1 | L |
| X8.7 | Crosshatch | line density, angle, luminance thresholds | C | P1 | M |
| X8.8 | Pencil sketch | stroke texture, paper texture, edge strength | C D N | P1 | M |
| X8.9 | Watercolor | wobble, edge darkening, paper granulation, bleed | C | P1 | L |
| X8.10 | Mosaic / stained glass (Voronoi) | cell size, edge color, jitter | C | P1 | M |
| X8.11 | Emboss / relief | angle, strength | C | P1 | S |
| X8.12 | Oil paint (brush strokes) | stroke length, flow field | C | P2 | L |
| X8.13 | Comic / manga | screentone, ink lines, speed lines | C D N | P2 | L |
| X8.14 | Blueprint | grid, line color, edges | C D N | P2 | S |
| X8.15 | Matrix rain / glyph stream | density, speed (motion-aware), glyph atlas, theme color | C | P2 | M |

### X9 — Distortion & warp

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X9.1 | Ripple / shockwave | center (pointer), speed, amplitude, wavelength, decay | C | P0 | S |
| X9.2 | Displacement map | texture, strength, channel mapping, scroll | C | P0 | S |
| X9.3 | Heat haze | strength, speed, noise scale, mask | C | P1 | S |
| X9.4 | Wave / sine warp | axis, amplitude, frequency, speed | C | P1 | S |
| X9.5 | Twirl / swirl | center, radius, angle | C | P1 | S |
| X9.6 | Kaleidoscope | segments, rotation, center | C | P1 | S |
| X9.7 | Mirror / symmetry | axis, mode | C | P1 | S |
| X9.8 | Bulge / pinch (pointer lens) | radius, strength, follows pointer | C | P1 | S |
| X9.9 | Liquid / flow-field warp | noise scale, strength, speed | C | P1 | M |
| X9.10 | Refraction (normal-map glass pane) | normal texture, IOR-like strength, chromatic dispersion | C | P2 | M |
| X9.11 | Droste / log-polar spiral | scale, periodicity | C | P2 | M |
| X9.12 | Water caustics overlay | scale, speed, intensity | C D | P2 | M |

### X10 — Atmosphere & lighting

| ID | Effect | Key parameters | Buffers | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X10.1 | Depth fog (screen) | color (theme surface), near/far, density, height falloff | C D | P0 | S |
| X10.2 | SSAO (normal-oriented hemisphere / GTAO-lite) | radius, intensity, samples, bias, blur | C D N | P1 | L |
| X10.3 | God rays (screen-space light shafts) | light source (object or position), density, decay, weight, samples | C D | P1 | M |
| X10.4 | Volumetric fog (ray-marched, low-res) | density, scattering, noise, steps | C D | P1 | L |
| X10.5 | Rim/backlight in screen space | color, width | C D N | P1 | S |
| X10.6 | Screen-space reflections (stretch goal) | max distance, thickness, steps, roughness fade | C D N | P2 | XL |
| X10.7 | Contact shadows | length, thickness | C D | P2 | M |
| X10.8 | Rain / snow overlay | density, angle, speed, depth-aware occlusion | C D | P2 | M |
| X10.9 | Underwater | tint, caustics, distortion, depth fog | C D | P2 | M |

### X11 — Holographic & iridescent (signature family)

This family is xtree's signature, named after HoloCSS. Colors default to the active HoloCSS theme roles. All shine and sparkle effects respond to pointer or device orientation, using HoloCSS `createTilt`-compatible inputs, and settle to a still frame when motion is off.

| ID | Effect | Kind | Key parameters | Pri | Size |
| --- | --- | --- | --- | --- | --- |
| X11.1 | Holographic foil (card shine) | Material + post overlay | rainbow gradient, pattern (cosmos, galaxy, linear, radial, glitter), angle from pointer/tilt, intensity, theme tint | P0 | L |
| X11.2 | Thin-film iridescence | Material (`onBeforeCompile` patch of `MeshPhysicalMaterial`, extending three's `iridescence`) | film thickness range, IOR, thickness map, view dependence | P0 | M |
| X11.3 | Hologram projection | Material | scanlines, fresnel rim, flicker (motion-aware, flash-safe), glitch offset, additive color | P0 | M |
| X11.4 | Prism / spectral dispersion | Post | spectrum samples, spread, center | P1 | M |
| X11.5 | Glitter / sparkle | Material + post | density, size, view-dependent twinkle, color | P1 | M |
| X11.6 | Interference / moiré pattern | Post | frequency, angle, two-layer offset | P1 | S |
| X11.7 | Holographic grid / HUD overlay | Post | grid size, theme accent, scan sweep, fade | P1 | M |
| X11.8 | Chromatic fresnel rim | Material | power, spectrum, width | P1 | S |
| X11.9 | Pearlescent / opal | Material | flake scale, hue range, sheen | P1 | M |
| X11.10 | Volumetric hologram (point-cloud / slice) | Material | slices, noise, density | P2 | L |
| X11.11 | Holo pointer spotlight | Post | radius, softness, spectral tint, follows pointer | P2 | S |
| X11.12 | Design audit: compare X11 against the HoloCSS visual language (Glass theme, gradients, accent roles) across all seventeen themes. Record which presets suit which themes. | Doc | Recorded in `docs/holocss-reference.md`, linked from every X11 page | P0 | M |

### X12 — Material effects

| ID | Effect | Key parameters | Pri | Size |
| --- | --- | --- | --- | --- |
| X12.1 | `patchMaterial()` framework: inject uniforms and code into Standard/Physical/Basic/Lambert/Phong/Toon materials safely, with cache keys and multiple patches per material. | Uses `customProgramCacheKey`. Patches compose. Recompiles happen only when structure changes. | P0 | L |
| X12.2 | Dissolve (noise burn) | threshold, edge width, edge color (theme accent), noise scale, direction | P0 | M |
| X12.3 | Fresnel glow | power, color, intensity, inverted | P0 | S |
| X12.4 | Force field / shield | intersection highlight (depth), hex pattern, ripple on hit | P1 | L |
| X12.5 | Toon / cel shading | bands, ramp texture, rim, specular steps | P1 | M |
| X12.6 | Wireframe glow (barycentric) | thickness, color, fill opacity | P1 | M |
| X12.7 | X-ray / see-through | edge power, occlusion mode | P1 | S |
| X12.8 | Vertex displacement / wobble | noise, amplitude, speed (motion-aware), normal recompute | P1 | M |
| X12.9 | Triplanar mapping | blend sharpness, scale | P1 | M |
| X12.10 | Matcap swap | texture, blend | P1 | S |
| X12.11 | Pixel-snap / PS1 look | vertex snap, affine texture wobble, color depth | P2 | M |
| X12.12 | Gradient / height color ramp | axis, gradient stops | P2 | S |
| X12.13 | Glass refraction material (transmission-lite) | IOR, thickness, dispersion, roughness blur | P2 | L |
| X12.14 | Slice / cross-section | plane, cap color, edge glow | P2 | M |

### X13 — Transitions

All transitions use the HoloCSS `ThreeEffect` contract: uniforms `progress`, `fromTexture`, `toTexture` and accent, plus a declared CSS `fallback`. They also have a standalone xtree API (`createTransition(renderer, from, to, effect)`).

| ID | Story / effect | Notes | Pri | Size |
| --- | --- | --- | --- | --- |
| X13.1 | Transition runtime and HoloCSS contract adapter | `toHoloEffect(xtreeTransition)` returns a valid `ThreeEffect`. Tested with `transition3d()` from a local HoloCSS build. | P0 | M |
| X13.2 | Crossfade with noise / luma wipe | luma texture, softness | P0 | S |
| X13.3 | Directional / radial / clock wipe | direction, softness, center | P1 | S |
| X13.4 | Glitch cut | uses the X6 chunks, flash-safe | P1 | M |
| X13.5 | Pixelate / mosaic transition | max cell size | P1 | S |
| X13.6 | Pixel-sort wipe | threshold sweep | P1 | M |
| X13.7 | Burn / dissolve with edge glow | theme accent edge | P1 | S |
| X13.8 | Morph (displacement-driven) | displacement texture, strength | P1 | S |
| X13.9 | Zoom / warp-speed | center, streaks | P1 | S |
| X13.10 | Holographic sweep | spectral band sweeping across | P1 | M |
| X13.11 | Shatter (geometry) | pieces, gravity. Needs a new geometry `kind` in the HoloCSS contract, which today only allows `cube` and `flip` | P2 | L |
| X13.12 | Fold / accordion (geometry) | folds, axis | P2 | M |
| X13.13 | Swirl / vortex | turns, radius | P2 | S |
| X13.14 | Ink bleed / watercolor reveal | noise, edge darkening | P2 | M |
| X13.15 | Provenance: work out with HoloCSS whether its seven transitions (dissolve, displacement, ripple, page-curl, mosaic, cube, flip) move into xtree, stay in HoloCSS, or are shared. | ADR plus migration notes on both repositories | P0 | S |

### X14 — Interaction, timing & orchestration

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X14.1 | Parameter tweening: `effect.animate({ intensity: 1 }, { duration, easing })` using CSS easing strings (the same parsing as HoloCSS `values()`). | `cubic-bezier()`, `steps()` and `linear()` easings are supported. Animations are cancelable with an `AbortSignal`. | M |
| X14.2 | Keyframed stacks: a timeline of parameter changes across several effects, scrubbable by progress. | Can be driven by scroll progress in a docs demo. | L |
| X14.3 | Pointer-reactive helpers: `followPointer(effect, 'center')`, with smoothing and coarse-pointer opt-out (matching `createTilt` behavior). | Touch/coarse pointers rest. Pointer leave returns to rest. | S |
| X14.4 | Device orientation input for tilt-driven holo effects, with permission handling on iOS. | Falls back to pointer, then to a static pose. | M |
| X14.5 | Audio-reactive binding: `bindAudio(effect, { param, band, gain })`. | Opt-in, user-gesture gated, and documented as decorative. | M |
| X14.6 | Scroll binding: `bindScroll(effect, param, { element })`, using native ScrollTimeline when available and a sampled fallback otherwise. | Matches HoloCSS `scrollProgress` semantics. | M |
| X14.7 | Seeded randomness: every stochastic effect takes `seed`, so renders are deterministic for tests and for "do not regenerate noise" policies. | The same seed produces identical frames across runs. | S |

### X15 — HoloCSS integration

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X15.1 | `@mk7s/xtree/holocss` entry with HoloCSS as an optional peer. It is the only entry that may import from `@mk7s/holocss`. | The core entries never import HoloCSS (checked by a build test). | S |
| X15.2 | Theme roles: `bindTheme(stack, element)` resolves `--hcss-accent`, `--hcss-surface` and `--hcss-text` (and status roles when present) and maps them onto parameters that each effect declares theme-aware. It re-resolves on theme change. | Switching between the seventeen HoloCSS themes updates outline, fog, gradient map and holo tints live. | M |
| X15.3 | Motion policy: `bindMotion(stack, element)` uses HoloCSS `motionAllowed`/`watchMotion` when present, and xtree's built-in equivalent otherwise. | High contrast and `data-hcss-motion="none"` freeze animated parameters, the same as OS reduced motion. | S |
| X15.4 | Stage interop: render an xtree `EffectComposer` into a HoloCSS `Stage` (its shared renderer, `own()` disposal and context-loss events). | No second WebGL context. Destroying the stage disposes xtree resources. | L |
| X15.5 | Post-processing for HoloCSS ambient `scene()` builders: wrap the `gradient`, `particles` and `litObject` scenes with an xtree stack. | The docs demo runs a HoloCSS ambient scene with bloom, film grain and holo foil applied. | M |
| X15.6 | Holochart showcase: apply effects to a Holochart canvas (shared renderer mode) without disturbing chart interaction. | A docs example page, built against local sibling checkouts. | M |

### X16 — Accessibility, motion & photosensitivity

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X16.1 | Built-in motion policy (`motionAllowed`/`watchMotion` equivalent) covering `prefers-reduced-motion`, `prefers-contrast: more`, `data-hcss-motion="none"` and `data-hcss-theme="high-contrast"`. | Matches HoloCSS semantics in a shared test table. | S |
| X16.2 | Motion-off behavior per effect: `freeze` (hold the current frame), `settle` (go to a defined still state), or `disable` (bypass). Each effect declares one. | Every effect's metadata declares a behavior. A CI test checks that no `time` uniform advances while motion is off. | M |
| X16.3 | Photosensitivity guard: luminance-delta and red-flash analysis over rendered frames (based on the WCAG 2.3.1 general and red flash thresholds), with a runtime limiter that clamps how often flashing parameters change. | Every glitch, flicker and strobe default preset passes the analyser in CI. Unsafe presets are flagged and disabled under any motion-off policy. | L |
| X16.4 | No unexpected autoplay: effects with time-based animation start only after `stack.play()` or with explicit `autoplay: true`. The docs demos have pause controls (WCAG 2.2.2). | Every docs demo has a visible pause/play button that is reachable by keyboard. | S |
| X16.5 | Canvas semantics guide: effects are decorative, so keep content in the DOM, and use `aria-hidden` overlays as HoloCSS does. | A guide page, plus a lint in the docs demo wrapper. | S |

### X17 — Performance & quality

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X17.1 | Reference hardware matrix: a mid laptop iGPU, a discrete desktop GPU, a mid Android phone and an iPhone. Record GPU ms per effect at 1080p (desktop) and at native resolution (mobile). | Results stored in `bench/results/*.json` and shown on each docs page. | M |
| X17.2 | Benchmark harness: Playwright runs a fixed scene and camera path and collects timer-query GPU times plus frame times. | `pnpm bench <effect>` prints a summary. A nightly CI job records trends. | L |
| X17.3 | Adaptive quality: a `quality: 'auto' | 'low' | 'medium' | 'high'` setting per effect, plus a composer-level governor that scales resolution or samples to hold a target frame time. | Under a synthetic GPU load the governor holds frame time within 10% of the target. | L |
| X17.4 | Half-resolution and checkerboard options for expensive passes (SSAO, volumetrics, DoF), with bilateral upsampling. | The visual difference is under the documented threshold. Time is reduced by at least 40%. | M |
| X17.5 | Compile-time cost: warm-up and precompile API (`composer.compileAsync()` using `KHR_parallel_shader_compile`). | No first-frame hitch in the docs page transitions. | M |
| X17.6 | Performance guide: cost table, recommended stacks, and mobile caveats. | Published in the docs. | S |

### X18 — Testing & verification

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X18.1 | Unit tests: schema, validation, serialization, merge codegen, presets. | ≥ 90% line coverage in `src/core`. | M |
| X18.2 | Shader compile tests: every effect, preset and define combination compiles in headless Chromium, Firefox and WebKit. | Runs on every PR. | M |
| X18.3 | Visual regression: render a fixed test scene (image, 3D model, gradient ramp, text) per effect and preset, compared with a perceptual diff and per-browser baselines. | Baseline update flow is `pnpm test:visual --update`, with diffs uploaded as CI artifacts. | L |
| X18.4 | Leak and lifecycle tests: create, render and dispose 1,000 times, then check `renderer.info.memory` and the program count return to baseline. Context loss and restore are tested. | Runs nightly and before release. | M |
| X18.5 | Docs fixture parity: every docs demo is also a test fixture (the HoloCSS convention). | Docs build fails if a demo has no fixture, or a fixture has no demo. | S |
| X18.6 | Validation records: a `docs/validation/<milestone>.md` per milestone with browser and hardware evidence, matching HoloCSS's `*-validation.md` style. | Required to close a milestone. | S |

### X19 — Documentation site (VitePress + HoloCSS)

**Goal:** a docs site that looks like a HoloCSS product, where every effect can be seen, adjusted, compared and copied.

#### X19-A — Site foundation and theme

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X19.1 | Scaffold VitePress in `docs/` with the base set for `mk7s.dev/xtree/` (configurable), clean URLs and the sitemap. | `pnpm docs:dev` and `pnpm docs:build` work. Builds in CI. | S |
| X19.2 | Consume HoloCSS: add `@mk7s/holocss` as a docs-only dependency (local `link:../holocss` or tarball until it is published). Import `tokens.css`, `components.css` and the `theme/bootstrap.js` blocking script. | Documented setup works from a fresh clone. CI fetches HoloCSS from a pinned tarball or git SHA. | M |
| X19.3 | Custom VitePress theme: extend the default theme and map its `--vp-c-*`, `--vp-font-*` and radius variables to the `--hcss-*` roles. Use HoloCSS components (`hcss-topbar`, `hcss-card`, `hcss-tabs`, `hcss-code-block`, `hcss-pager`, `hcss-breadcrumbs`, `hcss-prose`) where they replace VitePress chrome. | Visual diff against a HoloCSS docs page shows the same type scale, spacing, radii and surfaces. Passes a contrast audit in every theme. | L |
| X19.4 | Theme switcher: all seventeen HoloCSS themes plus `auto`, using `createTheme`, persisted with the HoloCSS storage key so the choice carries across mk7s sites. It replaces VitePress's light/dark toggle. | No flash of the wrong theme on load. The theme change also re-themes the live WebGL demos (through X15.2). | M |
| X19.5 | Motion control in the header, matching HoloCSS (`data-hcss-motion`), and wired to every demo through X15.3. | Setting motion to off stops all demos. | S |
| X19.6 | Landing page: a hero with a live, slowly animated holographic stack (X11), a grid of family cards, "install in 30 seconds", and links to the playground and gallery. | Lighthouse performance ≥ 90 on desktop. The hero WebGL loads lazily after first paint and has a static poster image. | M |

#### X19-B — Live demo runtime

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X19.7 | `<EffectDemo>` Vue component (client-only): mounts a canvas, a sample scene and an effect stack. It pauses offscreen (IntersectionObserver) and disposes on route change. | Navigating through 50 effect pages leaks no WebGL contexts. At most two contexts are alive at once, and WebGL contexts are shared where possible. | L |
| X19.8 | Sample scenes: a photo, a 3D model (glTF, CC0, Draco optional), text, a video, a gradient test card, and a HoloCSS ambient scene. Each demo picks a default, and the user can switch. | Assets total ≤ 5 MB and are lazily loaded. Licences are recorded. | M |
| X19.9 | Auto-generated controls from the parameter schema, rendered with HoloCSS form components (slider, number field, switch, select, color picker, segmented control). Parameters are grouped, with a reset per parameter. | Every parameter type in X1.1 has a control. Controls are keyboard-accessible and labelled. | L |
| X19.10 | Before/after comparison: a draggable split line (HoloCSS `split-pane`/slider styling), plus a toggle. | Works with keyboard and touch. | M |
| X19.11 | Live code panel: shows the import and setup code for the current parameter values (only the values that differ from the defaults), with tabs for vanilla three.js, the HoloCSS stage, and R3F (after X20). Has a copy button. | The copied code runs unchanged in a StackBlitz template. | M |
| X19.12 | Preset chips: apply a preset with one click, and the URL keeps the state (`?preset=broadcast&intensity=0.4`). | Shareable URLs restore the exact demo state. | S |
| X19.13 | Stats overlay: FPS and GPU ms (when timer queries are available), draw calls, programs. | Togglable, and hidden by default on mobile. | S |
| X19.14 | WebGL2-unavailable fallback: a poster image or video for each demo, with a notice. | Tested by forcing `getContext` to return null. | S |

#### X19-C — Content generation

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X19.15 | Effect page generator: builds `docs/effects/<family>/<id>.md` from effect metadata and an optional hand-written `notes.md`. Each page has the demo, install/import, parameters table, presets, buffers needed, cost, motion behavior, related effects, credits and previous/next. | Has a `--check` mode, wired into `pnpm check` as HoloCSS does. | L |
| X19.16 | Family index pages, with thumbnail grids (stills rendered by Playwright during the build). | Thumbnails are regenerated only when the effect hash changes. | M |
| X19.17 | Gallery: a filterable wall of every effect (filter by family, priority, cost, buffers needed and "motion-safe"), with hover-to-preview video loops. | Filtering is client-side and instant. Previews respect motion off. | M |
| X19.18 | API reference: TypeDoc plus `typedoc-plugin-markdown` output, integrated into the VitePress sidebar. | Every public export is documented. CI fails on undocumented exports. | M |
| X19.19 | Search: VitePress local search over guides, effects (including parameter names) and API. | Typing a parameter name (e.g. "threshold") lists the effects that have it. | S |

#### X19-D — Guides

| ID | Guide | Size |
| --- | --- | --- |
| X19.20 | Getting started: install, the first effect on an existing three.js scene, and the HoloCSS stage path. | S |
| X19.21 | Composing stacks: ordering, merging rules, blend modes, masks and selections. | M |
| X19.22 | Writing a custom effect with `defineEffect` and the shader chunk library. | M |
| X19.23 | Materials and `patchMaterial`. | S |
| X19.24 | Transitions and HoloCSS `transition3d`. | S |
| X19.25 | Theming with HoloCSS roles. | S |
| X19.26 | Motion, accessibility and photosensitivity. | S |
| X19.27 | Performance and mobile. | S |
| X19.28 | Migrating from three/examples `EffectComposer` and from pmndrs/postprocessing. | M |
| X19.29 | Recipes: "cyberpunk", "retro arcade", "film look", "holo trading card", "data-viz polish" (Holochart). | M |

#### X19-E — Playground and deployment

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X19.30 | Playground: build a stack from any effects. Drag to reorder, toggle and solo effects, edit parameters, switch scene, and export as code or JSON. | Exports run unchanged. Stack state is kept in the URL and in `localStorage`. | XL → split: layout, stack editor, export |
| X19.31 | "Open in StackBlitz" for every demo and playground state. | Works from the docs page in one click. | M |
| X19.32 | Deploy: build to static output and publish to `mk7s.dev/xtree/`, the same host and mutable-channel policy as HoloCSS. PR previews go to a staging path. | Has a deploy guard like the D0.5 rule in HoloCSS. | M |
| X19.33 | Docs quality gates: link checker, accessibility (axe on every page in two themes), and a per-route bundle budget. | Part of `pnpm check` (axe in browser CI). | M |

### X20 — Framework adapters (post-alpha)

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X20.1 | React Three Fiber: `<XtreeEffects>` and one component per effect, with props generated from the schema. | Optional peer. Published as the `@mk7s/xtree/r3f` subpath. | L |
| X20.2 | TresJS (Vue) adapter, which suits the VitePress docs and could power them. | Optional peer. | M |
| X20.3 | Threlte (Svelte) adapter. | Optional peer. | M |
| X20.4 | Code generation for adapter wrappers from metadata, so they never drift from the core. | `--check` in CI. | M |

### X21 — WebGPU / TSL (post-1.0 track)

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X21.1 | Spike: port five representative effects (vignette, bloom, outline, CRT, holo foil) to TSL nodes on `WebGPURenderer`'s `PostProcessing`. Measure the parity and performance gap. | ADR with a go/no-go decision and the porting strategy (hand-port, or codegen from a shared IR). | L |
| X21.2 | Shared effect IR: if the spike approves it, define an intermediate representation that emits both GLSL and TSL. | Five effects build for both targets from one source. | XL |
| X21.3 | `@mk7s/xtree/webgpu` entry and docs toggle. | Docs demos can switch renderer where it is supported. | L |

### X22 — Release & distribution

| ID | Story | Acceptance criteria | Size |
| --- | --- | --- | --- |
| X22.1 | Release policy doc: semver, the alpha/beta/rc channels, and how breaking changes to the parameter schema are handled. | Linked from the README. | S |
| X22.2 | npm publication: scope check, provenance, `files` allow-list, a `sideEffects` declaration, and turning off `private`. | `npm pack` contents are reviewed and match the export map. | M |
| X22.3 | CDN builds: ESM bundles per effect for `<script type="module">` use with an import map. | An import-map example works from plain HTML. | M |
| X22.4 | `llms.txt` and AI-friendly docs index, as HoloCSS ships. | Generated from metadata. | S |
| X22.5 | Changelog and upgrade notes for each release. | Changesets enforced in CI. | S |

---

## 7. Milestones

| Milestone | Scope | Exit criteria |
| --- | --- | --- |
| **M0 — Foundation** | X0 (all), ADRs 0001–0006, X2.1–X2.3, X19.1–X19.2 | `pnpm check` is green in CI. VitePress builds with HoloCSS tokens. ADRs accepted. |
| **M1 — Vertical slice** | X1.1–X1.4, X1.7, X1.13. Effects X3.4, X4.1, X5.2, X6.1, X11.1. X19.3, X19.7, X19.9, X19.15 | Five effects are fully done (§4) with generated pages, live controls and visual tests. Merging is proven equivalent. |
| **M2 — Alpha (P0 catalogue)** | The rest of X1 and X2. Every P0 effect (37). X13.1, X13.15, X15.1–X15.3, X16.1–X16.4, X18.1–X18.5, X19.4–X19.6, X19.10–X19.20 | `0.1.0-alpha.0` tarball. The docs site is deployed to staging. A HoloCSS theme and motion round trip is verified. |
| **M3 — Beta (P1 catalogue)** | Every P1 effect (about 70). X12.1 complete, X14, X15.4–X15.6, X17.1–X17.5, X19.16–X19.29 | `0.x-beta`. Docs have the gallery, guides and API reference. Benchmarks are published. |
| **M4 — Playground & adapters** | X19.30–X19.33, X20.1, X20.4 | Playground is live. The R3F adapter is published. |
| **M5 — 1.0** | Every P2 effect that passed triage, X17.6, X22 | ≥ 100 effects done. The API is frozen. Published on npm and deployed to `mk7s.dev/xtree/`. |
| **M6 — WebGPU** | X21 | Decided by the outcome of the X21.1 spike. |

Suggested order inside M2: color (cheap, exercises the merging) → lens → glow → glitch/retro → stylization → distortion → holographic → materials → transitions.

## 8. Verification matrix

| Area | How it is verified | When |
| --- | --- | --- |
| API types and validation | Vitest, `tsc --noEmit`, `tsd`-style type tests | Every PR |
| Shader compilation | Playwright in Chromium, Firefox and WebKit, every define combination | Every PR |
| Visual correctness | Perceptual-diff baselines per browser | Every PR (changed effects), nightly (all) |
| Merge equivalence | Merged output compared with unmerged output, ΔE < 1 | Every PR touching `core/` |
| Leaks and context loss | 1,000-cycle stress test, forced `loseContext()` | Nightly, before release |
| Motion policy | Simulated reduced motion and contrast, HoloCSS attributes; checks that time uniforms stay frozen | Every PR |
| Photosensitivity | Frame-sequence flash analyser on every animated preset | Every PR touching X6, X7, X11 |
| Performance | GPU timer-query benchmark on the reference hardware | Nightly, plus a manual mobile pass per milestone |
| Size | Per-entry gzip budgets | Every PR |
| Docs | Generated-page freshness, link check, axe in two themes, bundle budget | Every PR |
| HoloCSS interop | Integration tests against a pinned HoloCSS build (theme, motion, stage, `transition3d`) | Every PR touching `integrations/`, plus each HoloCSS bump |

## 9. Risks and open questions

| # | Risk / question | Mitigation / proposed answer |
| --- | --- | --- |
| 1 | **HoloCSS is unpublished** (0.1.0-alpha.0, private guard on). The docs and the integration entry can't install it from npm. | Use a pinned git SHA or a release tarball in CI. Switch to the npm range when HoloCSS publishes. Keep the core library free of any HoloCSS dependency (X15.1). |
| 2 | **Who owns the transitions?** HoloCSS already ships seven transition shaders. | Recommended: xtree becomes the home for shaders, and HoloCSS keeps its `transition3d` orchestration. HoloCSS's seven effects move to xtree and HoloCSS re-exports them, or HoloCSS keeps them and xtree adds new ones only. Decide in X13.15 with the HoloCSS owner. |
| 3 | **Three peer range** `<0.187.0` will go stale as three.js moves on (there are monthly r-releases). | Bump the range in lockstep with HoloCSS and Holochart. CI tests the lowest and highest versions in the range. |
| 4 | **Merging compiler complexity** (X1.4) is the riskiest core work. | Split it into three stories. Build the M1 vertical slice before scaling the catalogue. Keep an "unmerged" debug mode always available. |
| 5 | **Licences of ported techniques.** Many well-known effects exist only as Shadertoy code under CC BY-NC-SA. | Clean-room implementations from papers and descriptions. Enforce the credits/licence check in X0.9. |
| 6 | **Photosensitivity.** A glitch library is a natural source of seizure-risk content. | X16.3 analyser plus safe defaults. Unsafe presets are labelled and disabled when motion is off. |
| 7 | **Docs runtime weight.** 140 live WebGL demos risk leaking contexts and slowing the site. | One renderer shared across demos, lazy mounting, offscreen pause, and poster fallbacks (X19.7, X19.14). |
| 8 | **VitePress versus HoloCSS's own site generator.** Two docs systems in one family of sites. | Keep VitePress (as requested) and make its look match HoloCSS through X19.3. Revisit if HoloCSS later adopts VitePress or xtree is folded into the HoloCSS site. |
| 9 | **WebGPU drift.** three.js is investing heavily in TSL and WebGPU. | Keep shaders portable (§3.2), and run the X21.1 spike before 1.0 even though the full port is post-1.0. |
| 10 | **Package name** `@mk7s/xtree`. | Confirm the name is free on npm and that "xtree" is the final product name before X22. |
