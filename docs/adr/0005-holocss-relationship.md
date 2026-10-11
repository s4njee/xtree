# 0005 — Relationship with HoloCSS

Status: accepted, 2026-10-11.

## Context

[HoloCSS](https://github.com/s4njee/holocss) is the design reference for xtree. It provides theme roles (`--hcss-accent`, `--hcss-surface`, `--hcss-text`, …) across seventeen palettes, a motion policy (`motionAllowed`, `watchMotion`), a one-renderer-per-document three.js stage, and seven transition shaders behind its `ThreeEffect` contract. It is `0.1.0-alpha.0` and not on npm. At the pinned commit its full build fails because `src/glass/` is referenced but not committed. Its CSS and TypeScript sources are complete for the parts xtree's docs use.

## Decision

- **Library:** the core entries never import HoloCSS (ESLint enforces this). A later `@mk7s/xtree/holocss` entry (X15) adds theme, motion and stage integration with HoloCSS as an optional peer.
- **Docs:** the site reads HoloCSS **source** at the commit pinned in `holocss.json`. `scripts/holocss.mjs` fetches it into `.cache/holocss`, or uses `HOLOCSS_DIR` for a local checkout. VitePress aliases `@mk7s/holocss/components.css` and `@mk7s/holocss/theme` to the source files, and the classic theme bootstrap is bundled inline with esbuild. This avoids HoloCSS's build entirely.
- VitePress's color, font and button variables map onto HoloCSS roles, so every HoloCSS palette restyles the whole site. The site defaults to `auto` and shares the `hcss-theme` storage key with other mk7s sites.
- **Transitions:** whether HoloCSS's seven transition shaders move into xtree is decided with the HoloCSS owner in X13.15. Until then xtree adds only new transitions.

## Consequences

When HoloCSS publishes, the aliases are replaced by a normal `@mk7s/holocss` dependency and `holocss.json` is removed. Bumping the pin is a one-line change, followed by `pnpm docs:build`. The Glass palette has no styles at the pinned commit, because its source is missing.
