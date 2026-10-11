---
title: HoloCSS themes and motion
description: Make xtree effects follow the HoloCSS theme and motion policy with @mk7s/xtree/holocss.
---

# HoloCSS themes and motion

`@mk7s/xtree/holocss` connects effects to [HoloCSS](https://github.com/s4njee/holocss). Effects pick up its color roles and follow its motion policy, and they update live when the theme changes. It is the only entry that imports HoloCSS, which is an optional peer dependency. No other entry needs HoloCSS.

```ts
import { bindMotion, bindTheme } from '@mk7s/xtree/holocss';

const unbindTheme = bindTheme(
  [outline, fog, gradientMap, transitionPlayer],
  canvas,
);
const unbindMotion = bindMotion([composer, hologram], canvas);
```

Both functions take one target or a list, plus the element whose theme applies (usually the canvas). Each returns a function that stops following.

## Theme roles

Some color parameters declare a theme role. Their parameter tables show it as _theme: `accent`_. `bindTheme` reads the matching `--hcss-<role>` property for the element. It accepts any CSS color, including `oklch()` and `color-mix()`, and sets the parameter to that color. It sets the colors again when the theme changes. That happens when `data-hcss-theme`, `class` or `style` changes on the element or one of its ancestors, or when the color scheme or contrast preference changes.

| Role         | Used by                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent`     | Outline lines, glow, fresnel glow, hologram, dissolve edge, holographic foil and foil material tint, bloom tint, gradient map midtones, transition accents |
| `background` | Outline ink style paper, vignette, gradient map and monochrome shadows, halftone paper, ASCII background                                                   |
| `surface`    | Depth fog                                                                                                                                                  |
| `text`       | Gradient map and monochrome highlights, halftone ink, ASCII foreground                                                                                     |

A transition player (from `createTransition`) takes `accent` through `setAccent`. The roles are `accent`, `background`, `surface`, `elevated-surface`, `text`, `text-muted`, `success`, `warning`, `danger` and `info`. Roles the page doesn't define are skipped, so without HoloCSS the parameters keep their defaults.

You can override roles per parameter name, or opt a parameter out with `null`:

```ts
bindTheme(outline, canvas, { roles: { color: 'danger', paper: null } });
```

A color you set on a theme-aware parameter yourself stays until the next theme change. To read the colors without binding, use `resolveTheme(element)`, which returns `#rrggbb` strings. `applyTheme(targets, colors)` applies colors once.

## Motion

`bindMotion` uses HoloCSS's own `motionAllowed` and `watchMotion` from `@mk7s/holocss/runtime`. Motion stops under OS reduced motion, inside `data-hcss-motion="none"`, under the `high-contrast` theme, and under `prefers-contrast: more` while the theme is `auto`. A stopped composer or effect holds a still frame; see [motion and accessibility](/guide/getting-started#motion-and-accessibility).

Without HoloCSS, `bindMotion` from `@mk7s/xtree/motion` applies the same rule with xtree's built-in implementation. A test checks that both implementations agree.

## On a HoloCSS stage

HoloCSS's three.js bridge (`@mk7s/holocss/three`) draws every stage on the page with one shared WebGL renderer. `stageEffects` renders a stage through an xtree composer on that same renderer, so effects never cost a second WebGL context. The stage owns the composer: destroying the stage, or losing the context, disposes it and its effects. The composer follows HoloCSS's motion policy for the stage.

```ts
import { createStage } from '@mk7s/holocss/three';
import { EffectComposer } from '@mk7s/xtree/core';
import { stageEffects } from '@mk7s/xtree/holocss';
import { bloom } from '@mk7s/xtree/effects/bloom';

const stage = await createStage(element, { placement: 'inside' });
const composer = new EffectComposer(stage.renderer).add(bloom());
const render = stageEffects(stage, composer); // use instead of stage.render
render(scene, camera);
```

### Ambient scenes

`withEffects` wraps HoloCSS's ambient scene builders (`gradient`, `particles`, `litObject`, or your own) so `scene()` draws them through xtree effects. Everything else stays HoloCSS's: theme colors, the motion policy, and pausing while off screen.

```ts
import { scene } from '@mk7s/holocss/three';
import { litObject } from '@mk7s/holocss/three/scenes/object';
import { EffectComposer } from '@mk7s/xtree/core';
import { withEffects } from '@mk7s/xtree/holocss';

await scene(
  hero,
  withEffects(litObject, (renderer) =>
    new EffectComposer(renderer).add(holographicFoil(), bloom(), filmGrain()),
  ),
);
```

<AmbientEffects />

## Installing

HoloCSS isn't on npm yet. Until it is, install it from its repository at the pinned commit (see `holocss.json` in the xtree repository), or alias `@mk7s/holocss` to a local checkout in your bundler.
