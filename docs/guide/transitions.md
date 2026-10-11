---
title: Transitions
description: Blend between two images with xtree transitions, standalone or through HoloCSS's transition3d().
---

# Transitions

A transition blends from one image to another as `progress` goes from 0 to 1. xtree transitions run on their own, on any two textures, or inside HoloCSS's `transition3d()` for DOM elements.

## Standalone

```ts
import { createTransition } from '@mk7s/xtree/core';
import { crossfade } from '@mk7s/xtree/effects/crossfade';

const player = createTransition(renderer, crossfade({ preset: 'iris' }), {
  from: textureA, // for example render-target textures, or images with colorSpace = SRGBColorSpace
  to: textureB,
  accent: '#7cc4ff',
});

gsap.to(player, {
  progress: 1,
  duration: 1.2,
  onUpdate: () => player.render(),
});
```

`render()` draws to the canvas (in the renderer's output color space) or into a render target (linear). The textures belong to you: swap them with `player.from` and `player.to`, and call `player.dispose()` to release the shader. Parameters are properties of the transition, as with every effect.

To blend two 3D scenes, render each into a `WebGLRenderTarget` (an `EffectComposer` can render into one with `composer.render(delta, target)`) and use the targets' textures.

## With HoloCSS

`toHoloEffect()` turns a transition into a HoloCSS `ThreeEffect`:

```ts
import { transition3d } from '@mk7s/holocss/three';
import { toHoloEffect } from '@mk7s/xtree/core';
import { crossfade } from '@mk7s/xtree/effects/crossfade';

await transition3d(
  fromElement,
  toElement,
  toHoloEffect(crossfade({ pattern: 'radial' })),
  {
    target,
    update: () => swapContent(),
  },
);
```

HoloCSS captures the elements, supplies the theme accent, follows its motion policy (no transition when motion is off) and falls back to the CSS transition each effect names. Parameter values are baked into the shader when `toHoloEffect()` is called, because the contract has no room for extra uniforms; texture parameters (such as a custom luma image) work only standalone. HoloCSS's own seven transitions stay available alongside; see [ADR 0009](../adr/0009-transitions-and-holocss).

## Writing a transition

```ts
import { defineTransition, float } from '@mk7s/xtree/effect';

export const slide = defineTransition({
  name: 'slide',
  meta: {
    title: 'Slide',
    family: 'transition',
    story: 'X13',
    description: 'Pushes the image sideways.',
  },
  fallback: 'hcss-swing-left',
  params: {
    gap: float({
      default: 0.02,
      min: 0,
      max: 0.2,
      description: 'Gap between the images.',
    }),
  },
  fragment: /* glsl */ `
    vec4 $transition(vec2 uv, float progress) {
      float x = uv.x + progress * (1.0 + $gap);
      if (x < 1.0) return xt_from(vec2(x, uv.y));
      if (x < 1.0 + $gap) return vec4(xt_accent, 1.0);
      return xt_to(vec2(x - 1.0 - $gap, uv.y));
    }`,
});
```

`xt_from(uv)` and `xt_to(uv)` read the two images (linear color), `xt_size()` is their size in pixels and `xt_accent` the theme accent. At progress 0 a transition must show `from` and at 1 `to`; the tests check this for every preset.
