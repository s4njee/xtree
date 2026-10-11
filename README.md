# xtree

A comprehensive, tree-shakeable effects library for three.js, with a VitePress documentation site styled with [HoloCSS](https://github.com/s4njee/holocss).

**Status: M3 (beta) complete, `0.1.0-beta.0`.** 109 effects: 86 post-processing, 14 material and 9 transition, covering every P0 and P1 story. Geometry, velocity and history buffers and masks. `@mk7s/xtree/animation` for easing, timelines and pointer, scroll and audio bindings. HoloCSS theme, motion and stage integration. Precompiling, adaptive quality and benchmarks. A photosensitivity analyser. A docs site with live demos, a gallery, guides and an API reference (https://s4njee.github.io/xtree/). M4 (playground and adapters) is next. See [plan.md](plan.md) for every epic and story, and the [M0](docs/project/m0-validation.md), [M1](docs/project/m1-validation.md), [M2](docs/project/m2-validation.md) and [M3](docs/project/m3-validation.md) validation records for what was verified.

```ts
import { EffectComposer } from '@mk7s/xtree/core';
import { bloom } from '@mk7s/xtree/effects/bloom';
import { vignette } from '@mk7s/xtree/effects/vignette';

const composer = new EffectComposer(renderer);
composer.setScene(scene, camera);
composer.add(bloom({ preset: 'subtle' }), vignette({ darkness: 0.6 }));
renderer.setAnimationLoop(() => composer.render());
```

## Layout

| Path                     | What it is                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `packages/xtree`         | The library, `@mk7s/xtree` (private until release)                                    |
| `docs`                   | The VitePress site; pages under `docs/adr` and `docs/project` are the project records |
| `scripts`                | Repository scripts: HoloCSS checkout, release dry run                                 |
| `holocss.json`           | The HoloCSS commit the docs are built against                                         |
| `THIRD_PARTY_NOTICES.md` | Licences of code that shaders are derived from                                        |

## Development

Requires Node 22.12 or newer and pnpm 11.15.1 (`corepack enable`).

```sh
pnpm install --frozen-lockfile
pnpm check            # format, lint, GLSL lint, credits, typecheck, build, size, docs freshness, unit tests
pnpm test:browser     # GPU, integration and visual tests; Chromium by default, XT_BROWSERS=chromium,firefox,webkit for all
pnpm test:visual      # visual regression only; --update writes new or changed baselines for the browser
pnpm test:coverage    # the browser tests with line coverage (Chromium); src/core must stay at 90% or more
pnpm test:docs        # site tests (theme contrast, demos, navigation) after pnpm docs:build
pnpm docs:dev         # docs site at http://localhost:5173/xtree/
pnpm docs:build       # static site in docs/.vitepress/dist
pnpm release:dry      # pack the library and check the tarball against the export map
```

- **GLSL lint** compiles every chunk with `glslangValidator` when it is installed (`apt install glslang-tools`); CI requires it.
- **HoloCSS** is fetched at the pinned commit into `.cache/holocss` the first time the docs build. Set `HOLOCSS_DIR=../holocss` to use your own checkout. See [ADR 0005](docs/adr/0005-holocss-relationship.md).
- **Visual baselines** are per browser, in `packages/xtree/test/browser/__baselines__/<browser>/`. A browser without its own baselines is compared with Chromium's. To update every browser on CI's machines, run the "Visual baselines" workflow on your branch; it commits the images for review. CI uploads expected, actual and diff images when a comparison fails.
- **Nightly:** the "Nightly" workflow runs 1,000 create, render and dispose cycles of every effect in every browser (`XT_NIGHTLY=1`). Run it by hand before a release.
- **Changesets:** run `pnpm changeset` for every user-visible library change.

## Licence

MIT. Shader code derived from other projects is listed in `packages/xtree/credits.json` and its notices are in `THIRD_PARTY_NOTICES.md`.
