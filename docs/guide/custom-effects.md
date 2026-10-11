---
title: Writing an effect
description: Define your own effect with defineEffect and the shader chunk library, from a one-line color tweak to an effect with its own passes.
---

# Writing an effect

Every built-in effect is written with the same public API you can use: `defineEffect` from `@mk7s/xtree/effect`. An effect declares its parameters and a GLSL function; the composer compiles it, merges it with its neighbors and keeps its uniforms in sync.

## A first effect

```ts
import { color, defineEffect, float } from '@mk7s/xtree/effect';

export const tintedShadows = defineEffect({
  name: 'tinted-shadows',
  meta: {
    title: 'Tinted shadows',
    family: 'color',
    story: 'custom',
    description: 'Pushes the darkest tones toward a color.',
  },
  params: {
    tint: color({ default: '#2a3a8c', description: 'Shadow color.' }),
    amount: float({ default: 0.5, min: 0, max: 1, description: 'Strength.' }),
  },
  fragment: /* glsl */ `
    vec4 $main(vec4 color, vec2 uv) {
      float shadow = 1.0 - smoothstep(0.0, 0.25, dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)));
      return vec4(mix(color.rgb, color.rgb * $tint * 2.0, shadow * $amount), color.a);
    }
  `,
});

composer.add(tintedShadows({ amount: 0.7 }));
```

- `$main(color, uv)` receives this pixel's color, in **linear HDR** light before tone mapping, and returns the new one. Keep values above 1 rather than clamping them: bloom and tone mapping need them.
- `$name` refers to the effect's own parameters, textures and helper functions. The compiler prefixes them, so several copies of an effect can share a pass.
- The returned factory takes any parameters, a `preset`, `blend`, `opacity`, `enabled` and `mask`, and every parameter becomes a validated property (`effect.amount = 0.3`).

## Parameters

| Builder             | GLSL type                            | Notes                                                                               |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `float`, `int`      | `float`, `int`                       | `min`, `max`, `step`, `unit`.                                                       |
| `bool`              | `bool`                               |                                                                                     |
| `color`             | `vec3`                               | A CSS hex color, passed in linear RGB. `theme` follows a [HoloCSS role](./holocss). |
| `vec2`, `vec3`      | `vec2`, `vec3`                       | Ranges apply per component.                                                         |
| `select`            | `int`, with `$name_option` constants | Compare with `$mode == $mode_soft`.                                                 |
| `texture`           | `sampler2D`                          | `$has_name` is 1 when one is set; built-in samples can be offered by name.          |
| `gradient`, `curve` | `sampler2D`                          | Baked to 256×1 textures.                                                            |
| `seed()`            | `int`                                | For random patterns; see below.                                                     |

Mark a parameter `structural: true` to compile it as a `#define` instead of a uniform, for loop counts and branches. Changing it recompiles the pass, so keep it for settings that change rarely. `presets` are named sets of values, and `quality` tiers give an [adaptive composer](./performance#quality-tiers) cheaper settings.

## Shader chunks

The chunk library (`@mk7s/xtree/shaders`) has noise, color spaces, blending, depth reconstruction, sampling, SDF shapes and dithering. Include a chunk in GLSL and pass its map in `chunks`:

```ts
import { noiseFbmChunks } from '@mk7s/xtree/shaders';

defineEffect({
  // …
  chunks: [noiseFbmChunks],
  params: { scale: float({ default: 4, min: 0.5, max: 32 }), seed: seed() },
  fragment: /* glsl */ `
    #include <xtree/noise/fbm>
    vec4 $main(vec4 color, vec2 uv) {
      float n = xt_fbm(xt_seeded(uv * $scale, $seed), 4, 2.0, 0.5);
      return vec4(color.rgb * (0.85 + 0.15 * n), color.a);
    }
  `,
});
```

The [shader chunk reference](/reference/shaders) documents every function. Use `xt_seeded(coordinates, $seed)` for random patterns so a `seed` parameter changes them and the same seed always renders the same frames.

## Reading other pixels

By default an effect may only read its own pixel, which lets it merge into the pass before it. To sample elsewhere, as blurs and distortions do, set `sampling: 'input'` and read with `xt_sample(uv)`. The effect then starts a new pass.

Effects can also read the scene's geometry with `buffers: ['depth']`, `['normal']` or `['velocity']`: `xt_viewDepth(uv)`, `xt_viewNormal(uv)` and `xt_velocity(uv)`. See [masks and geometry buffers](./masks).

Built-in uniforms include `xt_resolution`, `xt_texel`, `xt_time`, `xt_delta`, `xt_frame`, `xt_pointer` and `xt_scroll`.

## Motion

An effect that animates (reads `xt_time`) must say what happens when motion is off, as the [motion policy](./accessibility) requires: `motion: 'freeze'` stops its clock, and `motion: { settle: { speed: 0 } }` substitutes still values. Keep animated changes slow enough to stay within three flashes a second; the [flash analyser](./accessibility#photosensitivity) can check your effect.

## Effects with their own passes

Some effects need intermediate results: a blur chain, a low-resolution buffer, last frame's image. `setup` runs once and returns resources that render before the merged pass each frame. `createPassKit` handles full-screen materials and render targets sized relative to the pass:

```ts
import { createPassKit, defineEffect, float } from '@mk7s/xtree/effect';

defineEffect({
  // …
  sampling: 'input',
  textures: ['blurred'],
  setup(context) {
    const kit = createPassKit(context);
    const blur = kit.material(blurSource, { source: { value: null } });
    const half = kit.target(0.5);
    return {
      setSize: kit.setSize,
      prepare(renderer, input, frame) {
        blur.uniforms.source!.value = input;
        kit.draw(renderer, blur, half);
        context.effect.uniforms.blurred!.value = half.texture;
      },
      dispose: kit.dispose,
    };
  },
  fragment: /* glsl */ `
    vec4 $main(vec4 color, vec2 uv) {
      return vec4(mix(color.rgb, texture($blurred, uv).rgb, 0.5), color.a);
    }
  `,
});
```

`frame` carries the time, the geometry buffers and the camera (`frame.camera.inverseProjection` and so on) for passes that reconstruct positions from depth. Per-frame values that aren't parameters go in `state: { dropout: 'float' }`, set from `prepare`. Effects never import three.js themselves: `context.three` provides the classes they need, so each effect stays a small, separate entry point.

## Material effects and transitions

`defineMaterialEffect` hooks into three.js's own materials instead of the screen (see [material effects](./materials)), and `defineTransition` blends two images (see [transitions](./transitions)). Both take the same parameter builders.
