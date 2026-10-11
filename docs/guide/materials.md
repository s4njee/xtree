---
title: Material effects
description: Patch fresnel glows, dissolves, thin-film iridescence, holograms and foil into three.js's built-in materials.
---

# Material effects

Post effects change the finished image. **Material effects** change how a mesh's own material shades: they are spliced into three.js's built-in materials, so the mesh keeps its lighting, shadows, fog and tone mapping, and the effect follows the object through the scene. [Fresnel glow](../effects/fresnel-glow), [dissolve](../effects/dissolve), [thin-film iridescence](../effects/thin-film), [hologram](../effects/hologram) and the [holographic foil material](../effects/foil-material) work this way.

```ts
import { patchMaterial, unpatchMaterial } from '@mk7s/xtree/core';
import { dissolve } from '@mk7s/xtree/effects/dissolve';
import { fresnelGlow } from '@mk7s/xtree/effects/fresnel-glow';

const burn = dissolve({ preset: 'embers' });
const rim = fresnelGlow({ color: '#5ad8ff' });
patchMaterial(mesh.material, burn, rim); // applied in order

burn.progress = 0.6; // a uniform: no recompile
unpatchMaterial(mesh.material, rim); // the material keeps the dissolve
```

`patchMaterial` works with `MeshBasicMaterial`, `MeshLambertMaterial`, `MeshPhongMaterial`, `MeshStandardMaterial`, `MeshPhysicalMaterial`, `MeshToonMaterial` and `MeshMatcapMaterial`. One effect can be patched into many materials, and a material can hold several effects. Changing a parameter updates a uniform; changing a _structural_ parameter recompiles the materials the effect is in. Programs are shared between materials with the same effects, and re-patching an effect of the same kind reuses the compiled program.

## Time and motion

Animated material effects have their own clock. Advance it once per frame; `setMotion(false)` stops it (and settles effects that declare still values), for example to follow `prefers-reduced-motion`:

```ts
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  burn.tick(clock.getDelta());
  renderer.render(scene, camera);
});
burn.setMotion(!matchMedia('(prefers-reduced-motion: reduce)').matches);
```

## Material settings

Some effects need blending changes: the hologram makes its material transparent and additive and turns off depth writes. `patchMaterial` applies those settings and `unpatchMaterial` restores the material's own.

## Writing a material effect

```ts
import { color, defineMaterialEffect, float } from '@mk7s/xtree/effect';

export const heightTint = defineMaterialEffect({
  name: 'height-tint',
  meta: {
    title: 'Height tint',
    family: 'material',
    story: 'X12',
    description: 'Tints by height.',
  },
  params: {
    color: color({ default: '#ff8800', description: 'Tint.' }),
    top: float({
      default: 2,
      min: 0,
      max: 10,
      description: 'Height of full tint.',
    }),
  },
  fragment: /* glsl */ `
    vec4 $fragment(vec4 color, XtSurface surface) {
      float t = clamp(surface.worldPosition.y / $top, 0.0, 1.0);
      return vec4(mix(color.rgb, color.rgb * $color, t), color.a);
    }`,
});
```

`$fragment` receives the material's lit color in linear HDR, before tone mapping, and may `discard`. An optional `vertex` defines `void $vertex(inout vec3 position, vec3 normal)` to move object-space vertices. `$time` is the effect's clock. `XtSurface` holds:

| Field            | Meaning                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `viewPosition`   | Position in view space                                                                       |
| `viewDirection`  | Unit vector toward the camera                                                                |
| `viewNormal`     | Shading normal facing the camera (with normal maps on lit materials)                         |
| `worldPosition`  | Position in world space                                                                      |
| `objectPosition` | Position in the object's own space, which moves with the object (good for noise that sticks) |
| `uv`             | First UV set (zero if the geometry has none)                                                 |

The GLSL lint compiles every material effect, lit and unlit, with glslang.

## Limits

Shadows and the depth prepass use separate materials, so a dissolved part still casts a shadow, and vertex effects such as the hologram's glitch don't move shadows. `ShaderMaterial`, `MeshNormalMaterial` and `MeshDepthMaterial` can't be patched.
