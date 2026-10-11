# Getting started

::: info Before the first release
`@mk7s/xtree` is not on npm yet. Use a local checkout until the first release (see [Work on xtree](#work-on-xtree)).
:::

## Add effects to a three.js scene

Install three.js (`>=0.180.0 <0.187.0`) and xtree, then replace `renderer.render(scene, camera)` with an `EffectComposer`:

```ts
import * as THREE from 'three';
import { EffectComposer } from '@mk7s/xtree/core';
import { bloom } from '@mk7s/xtree/effects/bloom';
import { vignette } from '@mk7s/xtree/effects/vignette';

const renderer = new THREE.WebGLRenderer();
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const composer = new EffectComposer(renderer);
composer.setScene(scene, camera);
composer.add(bloom({ preset: 'subtle' }), vignette({ darkness: 0.6 }));

renderer.setAnimationLoop(() => composer.render());
```

The composer renders the scene into a half-float buffer, runs the effects in linear HDR, and converts to the display at the end using the renderer's `toneMapping`, `toneMappingExposure` and `outputColorSpace`, exactly once. It follows the canvas size by itself; call `renderer.setSize` as usual.

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

`composer.motion = false` stops animated effects: some freeze on their current frame, and others switch to still values (the RGB split glitch stops jumping). While motion is off, setting `composer.time` changes nothing on screen. To follow the user's settings with [HoloCSS](https://github.com/s4njee/holocss):

```ts
import { motionAllowed, watchMotion } from '@mk7s/holocss/runtime';

composer.motion = motionAllowed(canvas);
const stop = watchMotion(canvas, (allowed) => (composer.motion = allowed));
```

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
pnpm docs:dev       # this site, with HoloCSS fetched at the pinned commit
pnpm test:docs      # site tests, after pnpm docs:build
```

Requires Node 22.12 or newer and pnpm 11. `pnpm glsl:lint` compiles every chunk and effect when `glslangValidator` is installed (`apt install glslang-tools`).
