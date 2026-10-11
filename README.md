# xtree

A comprehensive, tree-shakeable effects library for three.js, with a VitePress documentation site styled with [HoloCSS](https://github.com/s4njee/holocss).

**Status: M0 (foundation) complete.** The repository has its tooling, CI, architecture decisions, the documentation site, and a tested GLSL chunk library (noise, color science, blend modes). The composer and the first effects are M1. See [plan.md](plan.md) for every epic and story, and [the M0 validation record](docs/project/m0-validation.md) for what was verified.

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
pnpm test:browser     # GPU tests; Chromium by default, XT_BROWSERS=chromium,firefox,webkit for all
pnpm docs:dev         # docs site at http://localhost:5173/xtree/
pnpm docs:build       # static site in docs/.vitepress/dist
pnpm release:dry      # pack the library and check the tarball against the export map
```

- **GLSL lint** compiles every chunk with `glslangValidator` when it is installed (`apt install glslang-tools`); CI requires it.
- **HoloCSS** is fetched at the pinned commit into `.cache/holocss` the first time the docs build. Set `HOLOCSS_DIR=../holocss` to use your own checkout. See [ADR 0005](docs/adr/0005-holocss-relationship.md).
- **Changesets:** run `pnpm changeset` for every user-visible library change.

## Licence

MIT. Shader code derived from other projects is listed in `packages/xtree/credits.json` and its notices are in `THIRD_PARTY_NOTICES.md`.
