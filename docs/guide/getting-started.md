---
title: Getting started
description: Install xtree, add effects to an existing three.js scene, animate them, and connect them to HoloCSS.
---

# Getting started

::: info Before the first release
`@mk7s/xtree` is published as `0.1.0-alpha` builds for testing; the API can still change before 1.0. Until it is on npm, use a local checkout or the release tarball (see [Work on xtree](#work-on-xtree)).
:::

## Install

```sh
npm install @mk7s/xtree three
```

three.js is a peer dependency (`>=0.180.0 <0.187.0`). Each effect is its own import, such as `@mk7s/xtree/effects/bloom`, so your bundle carries only the effects you use. [HoloCSS](https://github.com/s4njee/holocss) is optional; see [the HoloCSS path](#the-holocss-path).

## Your first effect on an existing scene

Keep your scene, camera and renderer. Replace `renderer.render(scene, camera)` with an `EffectComposer`:

```ts
import * as THREE from 'three';
import { EffectComposer } from '@mk7s/xtree/core';
import { bloom } from '@mk7s/xtree/effects/bloom';
import { vignette } from '@mk7s/xtree/effects/vignette';

// Your existing setup.
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  innerWidth / innerHeight,
  0.1,
  100,
);

// Effects.
const composer = new EffectComposer(renderer);
composer.setScene(scene, camera);
composer.add(bloom({ preset: 'subtle' }), vignette({ darkness: 0.6 }));

renderer.setAnimationLoop(() => composer.render());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
```

The composer renders the scene into a half-float buffer, runs the effects in linear HDR, and converts to the display at the end using the renderer's `toneMapping`, `toneMappingExposure` and `outputColorSpace`, exactly once. It follows the canvas size by itself. Turn off the renderer's own `antialias`; pass `{ multisampling: 4 }` to the composer instead.

## Animated effects need `play()`

Effects such as film grain, glitches and holographic foil animate with the composer's clock, which does not start by itself, so nothing moves until you ask for it:

```ts
import { filmGrain } from '@mk7s/xtree/effects/film-grain';

composer.add(filmGrain());
composer.play(); // or new EffectComposer(renderer, { autoplay: true })
```

`composer.pause()` holds the current frame. To drive effects from your own timeline, set `composer.time` (seconds) or `composer.progress` (0–1), or follow a source with `composer.drive(source)`.

## Change effects at runtime

Every parameter is a typed property, and every effect has `blend`, `opacity` and `enabled`:

```ts
const glow = bloom();
glow.intensity = 1.5; // updates a uniform; no recompile
glow.applyPreset('neon');
glow.opacity = 0.5;
glow.blend = 'screen'; // structural: recompiles the pass that contains it
glow.enabled = false;
```

Invalid values throw a `TypeError` or `RangeError` that names the effect and parameter, before anything changes.

## How effects are merged

Consecutive effects compile into one shader, so five color effects cost one full-screen pass. Effects that sample neighboring pixels (chromatic aberration, glitches) or render their own passes (bloom) start a new pass; the effects after them join it. Each effect page shows how it merges. Set `composer.merge = false` to give every effect its own pass while debugging.

## Motion and accessibility

`composer.motion = false` stops animated effects: some freeze on their current frame, and others switch to still values (the RGB split glitch stops jumping). While motion is off, setting `composer.time` changes nothing on screen.

To follow the user's settings, use `bindMotion`. Motion then stops under OS reduced motion, inside `data-hcss-motion="none"` and under the high-contrast theme, and starts again when those settings change:

```ts
import { bindMotion } from '@mk7s/xtree/motion';

const unbind = bindMotion([composer, hologram], canvas);
```

With [HoloCSS](https://github.com/s4njee/holocss), use `bindMotion` from `@mk7s/xtree/holocss` instead. It applies HoloCSS's own policy, and `bindTheme` from the same entry lets effects follow the theme colors (see [HoloCSS themes and motion](/guide/holocss)).

## The HoloCSS path

On a page styled with HoloCSS, `@mk7s/xtree/holocss` connects effects to it. Theme-aware colors (outline lines, fog, gradient maps, holographic tints and transition accents) follow the active theme and update when it changes, and animation follows HoloCSS's motion policy:

```ts
import { bindMotion, bindTheme } from '@mk7s/xtree/holocss';
import { depthFog } from '@mk7s/xtree/effects/depth-fog';
import { holographicFoil } from '@mk7s/xtree/effects/holographic-foil';
import { outline } from '@mk7s/xtree/effects/outline';

const effects = [outline(), depthFog(), holographicFoil()];
composer.add(...effects);
bindTheme(effects, renderer.domElement);
bindMotion(composer, renderer.domElement);
composer.play();
```

Transitions between DOM elements go through HoloCSS's `transition3d()` with `toHoloEffect()`; see [Transitions](/guide/transitions#with-holocss). To render inside HoloCSS's shared `Stage` (one WebGL context for the whole page) instead of a renderer of your own, use `stageEffects`; see [on a HoloCSS stage](/guide/holocss#on-a-holocss-stage). More in [HoloCSS themes and motion](/guide/holocss).

## Use three.js's own EffectComposer

Each group of xtree effects can also be an `EffectPass` in the composer from `three/examples`. Put three's `OutputPass` last, because xtree passes work in linear HDR:

```ts
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EffectPass } from '@mk7s/xtree/core';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass([bloom(), vignette()]));
composer.addPass(new OutputPass());
```

## Write your own effect

The [writing an effect](/guide/custom-effects) guide covers parameters, shader chunks and effects with their own passes. In short:

```ts
import { defineEffect, float, color } from '@mk7s/xtree/effect';

export const tintEffect = defineEffect({
  name: 'tint',
  meta: {
    title: 'Tint',
    family: 'color',
    story: 'custom',
    description: 'Multiplies the image by a color.',
  },
  params: {
    amount: float({
      default: 0.5,
      min: 0,
      max: 1,
      description: 'Strength of the tint.',
    }),
    tint: color({ default: '#ff8800', description: 'Tint color.' }),
  },
  fragment: /* glsl */ `
    vec4 $main(vec4 color, vec2 uv) {
      return vec4(mix(color.rgb, color.rgb * $tint, $amount), color.a);
    }`,
});
```

`$name` refers to the effect's own parameters and helpers; the compiler renames them per effect so several copies merge into one shader. Include [shader chunks](/reference/shaders) with `#include <xtree/...>` and list their chunk maps in `chunks`.

## Work on xtree

```sh
pnpm install
pnpm check          # format, lint, GLSL lint, credits, types, build, size, generated files, unit tests
pnpm test:browser   # GPU and visual tests in Chromium (XT_BROWSERS=chromium,firefox,webkit for all)
pnpm test:visual    # visual regression; --update writes new or changed baselines
pnpm docs:dev       # this site, with HoloCSS fetched at the pinned commit
pnpm test:docs      # site tests, after pnpm docs:build
```

Requires Node 22.12 or newer and pnpm 11. `pnpm glsl:lint` compiles every chunk and effect when `glslangValidator` is installed (`apt install glslang-tools`).
