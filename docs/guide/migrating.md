---
title: Migrating
description: Move from three.js's example EffectComposer or pmndrs/postprocessing to xtree, step by step or all at once.
---

# Migrating

xtree's composer works like the ones you may know: render the scene once, then run effects over the image. You can switch all at once, or keep your current composer and add xtree effects as passes inside it.

## From `three/examples` `EffectComposer`

| three.js examples                                                           | xtree                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `new EffectComposer(renderer)` + `RenderPass(scene, camera)`                | `new EffectComposer(renderer).setScene(scene, camera)`                                                                                                                                                       |
| `UnrealBloomPass`                                                           | [`bloom`](../effects/bloom) (or [`selective-bloom`](../effects/selective-bloom) for chosen objects)                                                                                                          |
| `OutputPass` (tone mapping and color space)                                 | Built in: the composer applies `renderer.toneMapping` and the output color space after the last effect.                                                                                                      |
| `ShaderPass(VignetteShader)`, `RGBShiftShader`, `FilmPass`, `DotScreenPass` | [`vignette`](../effects/vignette), [`chromatic-aberration`](../effects/chromatic-aberration), [`film-grain`](../effects/film-grain) + [`scanlines`](../effects/scanlines), [`halftone`](../effects/halftone) |
| `GlitchPass`                                                                | [`rgb-split-glitch`](../effects/rgb-split-glitch), [`block-displacement`](../effects/block-displacement), [`scanline-tear`](../effects/scanline-tear)                                                        |
| `SSAOPass`, `GTAOPass`                                                      | [`ssao`](../effects/ssao)                                                                                                                                                                                    |
| `BokehPass`                                                                 | [`depth-of-field`](../effects/depth-of-field)                                                                                                                                                                |
| `OutlinePass`                                                               | [`outline`](../effects/outline) with a [selection mask](./masks)                                                                                                                                             |
| `AfterimagePass`                                                            | [`lcd`](../effects/lcd) persistence, or [`motion-blur`](../effects/motion-blur) for real motion                                                                                                              |
| `LUTPass`                                                                   | [`lut`](../effects/lut)                                                                                                                                                                                      |
| `ShaderPass(yourShader)`                                                    | [`defineEffect`](./custom-effects), which merges with its neighbors                                                                                                                                          |

Each `ShaderPass` is a full-screen draw; an xtree stack merges compatible effects into one pass, so long stacks usually get cheaper.

### Step by step

You don't have to switch composers. Wrap xtree effects in an `EffectPass` and add it to the composer you have, then put three's `OutputPass` last, because xtree passes work in linear HDR:

```ts
import { EffectPass } from '@mk7s/xtree/core';

composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(size, 1, 0.4, 0.85)); // still yours
composer.addPass(new EffectPass([chromaticAberration(), vignette()])); // merged into one pass
composer.addPass(new OutputPass());
```

If an xtree effect reads depth or normals, call `pass.setGeometry({ depth, normal, camera })` yourself before rendering; xtree's own composer renders those buffers only when an effect needs them. Going the other way, the xtree composer accepts three.js passes in its stack, so you can keep a custom pass while moving everything else:

```ts
composer.add(bloom(), new MyLegacyPass(), vignette());
```

## From pmndrs/postprocessing

The concepts match closely: an `EffectComposer`, effects grouped into merged passes, blend functions per effect.

| postprocessing                                                   | xtree                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `composer.addPass(new RenderPass(scene, camera))`                | `composer.setScene(scene, camera)`                                                                                                              |
| `new EffectPass(camera, a, b, c)`                                | `composer.add(a, b, c)`: merging is automatic                                                                                                   |
| `effect.blendMode.blendFunction = BlendFunction.SCREEN`          | `effect.blend = 'screen'`                                                                                                                       |
| `effect.blendMode.opacity.value = 0.5`                           | `effect.opacity = 0.5`                                                                                                                          |
| `BloomEffect`, `SelectiveBloomEffect`                            | [`bloom`](../effects/bloom), [`selective-bloom`](../effects/selective-bloom)                                                                    |
| `VignetteEffect`, `NoiseEffect`, `ScanlineEffect`                | [`vignette`](../effects/vignette), [`film-grain`](../effects/film-grain), [`scanlines`](../effects/scanlines)                                   |
| `ChromaticAberrationEffect`, `GlitchEffect`, `PixelationEffect`  | [`chromatic-aberration`](../effects/chromatic-aberration), [`rgb-split-glitch`](../effects/rgb-split-glitch), [`pixelate`](../effects/pixelate) |
| `DepthOfFieldEffect`, `TiltShiftEffect`, `GodRaysEffect`         | [`depth-of-field`](../effects/depth-of-field), [`tilt-shift`](../effects/tilt-shift), [`god-rays`](../effects/god-rays)                         |
| `SSAOEffect` (or N8AO)                                           | [`ssao`](../effects/ssao)                                                                                                                       |
| `OutlineEffect`, `SMAAEffect`                                    | [`outline`](../effects/outline); no anti-aliasing effect yet (use MSAA: `new EffectComposer(renderer, { multisampling: 4 })`)                   |
| `LUT3DEffect`, `HueSaturationEffect`, `BrightnessContrastEffect` | [`lut`](../effects/lut), [`hue-saturation`](../effects/hue-saturation), [`brightness-contrast`](../effects/brightness-contrast)                 |
| `ShockWaveEffect`, `ASCIIEffect`, `DotScreenEffect`              | [`ripple`](../effects/ripple), [`ascii`](../effects/ascii), [`halftone`](../effects/halftone)                                                   |
| `ToneMappingEffect`                                              | `renderer.toneMapping`, applied by the composer                                                                                                 |
| `new Effect(name, fragment, { uniforms })`                       | [`defineEffect`](./custom-effects); `mainImage(inputColor, uv, outputColor)` becomes `vec4 $main(vec4 color, vec2 uv)`                          |

Differences worth knowing:

- **Linear HDR throughout.** Effects see linear light before tone mapping, so a bloom threshold of 1 means "brighter than white", not "white in sRGB".
- **Animated effects wait for `play()`.** Nothing animates until you start it, and the [motion policy](./accessibility) can stop it.
- **Masks are built in.** Any effect takes a texture, depth range or object [selection](./masks) as a mask, instead of a separate selective variant.
- **Effects are separate entry points** (`@mk7s/xtree/effects/<name>`), so you only ship the ones you use.
