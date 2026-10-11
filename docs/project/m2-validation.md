# M2 validation

Milestone M2 (alpha) covers:

- **Effects:** all 37 P0 effects across color and tone (X3.1–X3.8), lens and camera (X4.1–X4.5), blur and glow (X5.1–X5.4), glitch (X6.1–X6.4), retro (X7.1–X7.4), stylization (X8.1–X8.3), distortion (X9.1–X9.2), depth fog (X10.1), holographic (X11.1–X11.3), materials (X12.2–X12.3) and the crossfade transition (X13.2). There are also two extras: a buffer view (X1.6) and a material form of holographic foil.
- **Core:** the rest of X1 and X2. That means geometry buffers and masks, material patching, the clock, inputs, serialization and debugging, plus the sampling, SDF, dither, depth and spectral chunks.
- **Transitions:** X13.1 and X13.15.
- **HoloCSS:** X15.1–X15.3.
- **Accessibility and safety:** X16.1–X16.4.
- **Tests:** X18.1–X18.5.
- **Docs:** X19.4–X19.6 and X19.10–X19.20.

Exit criteria: a `0.1.0-alpha.0` tarball, the docs deployed to staging, and a verified HoloCSS theme and motion round trip.

Recorded 2026-10-11 in a Linux container with Node 22.22.0, pnpm 11.15.1, headless Chromium 141 (SwiftShader WebGL2) and glslangValidator 15.1.0. Firefox and WebKit run in CI on GitHub Actions (ubuntu-latest).

## Results

| Check                                      | Result                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (with `XT_REQUIRE_GLSLANG=1`) | Pass. The GLSL lint compiles 21 chunks and 39 effects (351 merged variants) with glslang. Also passing: credits, the export map, typecheck, the API reference with undocumented exports treated as errors, size budgets, generated-file checks and 153 unit tests, including Node imports of every entry without a DOM.                                                                       |
| `pnpm test:browser`                        | 245 passed in Chromium locally. CI runs the same suite in Chromium, Firefox and WebKit, each against its own visual baselines (241 per browser), and all three are green.                                                                                                                                                                                                                     |
| `pnpm test:coverage` (X18.1)               | `src/core` at 98.0% of lines (1981 of 2022) in Chromium; the gate is 90%. CI enforces the gate and uploads the report.                                                                                                                                                                                                                                                                        |
| `pnpm test:docs`                           | 33 passed: contrast in all 18 themes, every page, demos, navigation, the theme switcher, motion control, hero, compare, code tabs, URL state, stats, WebGL2 fallback, gallery, parameter search and the API reference.                                                                                                                                                                        |
| `pnpm release:dry`                         | `mk7s-xtree-0.1.0-alpha.0.tgz`, 221 files, matches the export map. CI uploads it as an artifact.                                                                                                                                                                                                                                                                                              |
| Tarball smoke test                         | In an empty project with three 0.186.1 and TypeScript 6.0.3, the tarball typechecks with `skipLibCheck: false` and without HoloCSS installed. Its entries also import and run in Node.                                                                                                                                                                                                        |
| Lighthouse (X19.6)                         | Desktop performance 98 on the home page (LCP 0.6 s, total blocking time 100 ms), against the built site. Software WebGL is the worst case for the hero, so it stays on a still frame there.                                                                                                                                                                                                   |
| Nightly leak run (X18.4)                   | Pass. The "Nightly" workflow ([run 38142610317](https://github.com/s4njee/xtree/actions/runs/38142610317), commit `5422b3b`) ran 1,000 create, render and dispose cycles of every effect, plus repeated context loss, in Chromium, Firefox and WebKit, and memory and programs returned to baseline in all three. It runs again before each release. Every PR runs 42 cycles, one per effect. |

## HoloCSS round trip

These tests use HoloCSS's real token CSS and runtime from the pinned commit (`packages/xtree/test/browser/holocss.spec.ts`):

- **Themes.** The test switches all 17 built-in themes on an ancestor element. For each one, the bound outline, fog, gradient map and holographic foil colors, and a transition player's accent, equal the theme's resolved `--hcss-*` roles. The 17 themes give more than 8 distinct accents.
- **Motion.** HoloCSS's `bindMotion` stops a composer under `high-contrast`, `data-hcss-motion="none"` and OS reduced motion. Motion resumes when the attribute is removed.
- **The docs site.** The header theme switcher re-themes a live demo's colors and persists under HoloCSS's `hcss-theme` key; the choice is restored before first paint. The motion switch sets `data-hcss-motion` and stops the demos.

## Safety

- **Photosensitivity (X16.3).** Every animated effect and preset passes the WCAG 2.3.1 flash analyser over two seconds of frames. Three presets that failed were slowed and staggered.
- **Motion off (X16.2).** Every effect renders identical frames while playing with motion off.
- **No autoplay (X16.4).** Nothing advances until `play()`.

## Known gaps and deferrals

- **X1.6 velocity buffer.** Not built; depth and normals are. It moves to M3 with motion blur.
- **X19.11 code tabs.** The tabs are "three.js" and "With HoloCSS" (`bindTheme`, `bindMotion`, `transition3d`). A HoloCSS Stage tab needs the stage interop of X15.4 (M3), and an R3F tab needs X20. The "runs unchanged in StackBlitz" check waits for the StackBlitz template (X19.31).
- **X19.17 gallery.** Filtering is client-side and instant, but the hover-to-preview video loops are not built yet: there are no recorded loops.
- **X19.16 thumbnails.** These are the Chromium visual baselines of each effect. They change only when an effect's rendered output changes, rather than on a hash of its source. Families are sections of the catalogue with anchors, not separate pages.
- **X18.1 coverage.** Measured from the browser tests in Chromium only. Node unit tests are not merged into the figure.
- **X18.3 comparison.** Visual comparison uses Playwright's perceptual (YIQ) threshold with a 1% pixel allowance.
- **HoloCSS packaging.** HoloCSS is not on npm, so `@mk7s/holocss` is an optional peer that is not installed. The workspace sets `autoInstallPeers: false`.
- **Staging.** The docs deploy from this branch to GitHub Pages (https://s4njee.github.io/xtree/).
