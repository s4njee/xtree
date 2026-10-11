---
title: Performance
description: Precompile shaders before the first frame, hold a frame-time budget with the adaptive composer and quality tiers, render expensive passes at reduced resolution, and benchmark effects.
---

# Performance

Most effects merge into a few full-screen passes and cost little; a handful (ambient occlusion, volumetric fog, depth of field, large blurs) are expensive. This page covers the tools for keeping a scene smooth: precompiling shaders, holding a frame-time budget, reduced-resolution passes and benchmarks.

## Precompile before the first frame

Shaders compile the first time they are drawn, which can stall that frame for tens of milliseconds, noticeably during a page transition. `compileAsync()` compiles everything the next frame needs without drawing: the scene's materials (including [patched](./materials) ones), the merged effect passes and the shaders effects render their own passes with. Where the browser supports `KHR_parallel_shader_compile`, the work happens off the main thread.

```ts
composer.setScene(scene, camera).add(bloom(), ssao(), vignette());
await composer.compileAsync(); // then reveal the canvas
composer.render();
```

Call it after the stack is set up. Changing the stack afterwards compiles the changed passes on the next render, as usual. The geometry prepasses (normals, velocity, selection masks) use small built-in materials; `compileAsync` compiles them by drawing them once, off screen.

## Hold a frame-time budget

`setAdaptive` turns on a governor that holds a target frame time. When frames run long it first lowers the resolution the scene and effects render at, down to `minScale`, and then lowers the **quality tier** of effects whose `quality` is `auto`. When there is time to spare it raises them again, with hysteresis so it doesn't flicker between settings.

```ts
composer.setAdaptive({ targetMs: 1000 / 60, minScale: 0.5 });
composer.adaptive; // { scale: 0.85, quality: 'high' }
composer.setAdaptive(null); // full resolution and quality again
```

It measures GPU time where the browser has timer queries (`EXT_disjoint_timer_query_webgl2`) and the time between frames otherwise. Frame intervals can't show spare time under vsync, so after a steady stretch below full quality it tries a step up and steps back down if that misses the target. In tests against a synthetic GPU load it holds the frame time within 10% of the target.

You can also set the resolution yourself with `composer.resolutionScale` (0.25 to 1).

### Quality tiers

Expensive effects declare cheaper settings for their cost parameters, listed under **Quality tiers** on their pages. For example, [ambient occlusion](../effects/ssao) uses 6 samples at quarter resolution when `low`, and 10 samples when `medium`.

```ts
const ao = ssao({ samples: 24 });
ao.quality = 'low'; // the low tier's samples and resolution
ao.quality = 'high'; // back to samples: 24
ao.quality = 'auto'; // the default: an adaptive composer chooses
```

`high` is always the effect's own values: the first time a lower tier applies, the effect remembers its settings for those parameters and restores them when it returns to `high`. Effects without tiers ignore `quality`.

## Reduced-resolution passes

Ambient occlusion and volumetric fog render at half resolution by default (`resolution: 0.5`), and depth of field can (`resolution: 'half'`). Their results are upsampled with depth-aware weights: each pixel blends the four nearest low-resolution texels by how close their depth is to its own, so occlusion, fog and blur don't bleed across silhouettes. Depth of field keeps in-focus pixels at full resolution.

In the test scene, half resolution cuts each effect's cost by well over 40% (depth of field by about 89%). The browser tests hold the image difference against full resolution under these limits:

| Effect                                      | Mean difference | 99th percentile |
| ------------------------------------------- | --------------- | --------------- |
| [Ambient occlusion](../effects/ssao)        | under 1%        | under 10%       |
| [Volumetric fog](../effects/volumetric-fog) | under 1%        | under 10%       |
| [Depth of field](../effects/depth-of-field) | under 2%        | under 30%       |

Depth of field differs most near silhouettes under strong blur. Checkerboard rendering is not implemented yet.

## Benchmarks

`pnpm bench` renders a fixed scene and camera path in Chromium with each effect and prints what each adds to the frame time, and the GPU time where timer queries are available:

```sh
pnpm bench ssao bloom --frames 40 --size 1920x1080
pnpm bench --out bench/results/my-laptop.json --label "My laptop (Intel Iris Xe)"
```

With `--out`, results merge into a JSON file in `bench/results/`, and every effect page lists its cost from each file there. The harness covers post effects; materials and transitions are not benchmarked yet. The numbers published so far come from the CI container, which renders in software (SwiftShader): use them to compare effects with each other, not to predict times on a GPU. Results from reference hardware (a laptop iGPU, a discrete desktop GPU, a mid-range Android phone and an iPhone) are still to come.
