# @mk7s/xtree

A comprehensive, tree-shakeable effects library for three.js: post-processing, materials and transitions.

**Status: M1 (vertical slice).** The effect API, the composer and five effects. Not yet published to npm.

```ts
import { EffectComposer } from '@mk7s/xtree/core';
import { bloom } from '@mk7s/xtree/effects/bloom';

const composer = new EffectComposer(renderer);
composer.setScene(scene, camera);
composer.add(bloom());
renderer.setAnimationLoop(() => composer.render());
```

```ts
import { resolveIncludes, formatShaderError } from '@mk7s/xtree/glsl';
import { noise } from '@mk7s/xtree/shaders/noise';

const { code, files } = resolveIncludes(
  '#include <xtree/noise/simplex>\n/* your shader */',
  noise,
);
```

| Export                      | Contents                                                                       |
| --------------------------- | ------------------------------------------------------------------------------ |
| `@mk7s/xtree`               | `version` and the GLSL utilities                                               |
| `@mk7s/xtree/glsl`          | `resolveIncludes`, `formatShaderError`, `minifyGlsl`                           |
| `@mk7s/xtree/shaders`       | Every chunk (`chunks`) and each family                                         |
| `@mk7s/xtree/shaders/noise` | Hash, value, gradient, simplex, Worley, fBm, curl and dither noise             |
| `@mk7s/xtree/shaders/color` | sRGB, HSV, HSL, OKLab, OKLCH, YIQ, YUV, luminance, white balance, tone mapping |
| `@mk7s/xtree/shaders/blend` | 26 blend modes and the `blendModes` constants                                  |

`three` (`>=0.180.0 <0.187.0`) is a peer dependency. MIT licensed; third-party notices are in `THIRD_PARTY_NOTICES.md`.
