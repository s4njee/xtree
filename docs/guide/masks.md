---
title: Masks and geometry buffers
description: Limit any effect to a texture, a depth range or selected objects, and read the scene's depth and normals from effects.
---

# Masks and geometry buffers

Every effect can be limited to part of the image with a **mask**, and some effects read the scene's **depth** and **normals**. The composer renders the extra buffers only while an enabled effect needs them.

## Masks

Set `mask` when you create an effect, or change it later:

```ts
import { monochrome } from '@mk7s/xtree/effects/monochrome';
import { rgbSplitGlitch } from '@mk7s/xtree/effects/rgb-split-glitch';

// Glitch only the hero object, and grey out everything far away.
const glitch = rgbSplitGlitch({ mask: { selection: [hero] } });
const distance = monochrome({ mask: { depth: [20, 1000], feather: 5 } });
composer.add(glitch, distance);

glitch.mask = { selection: { layer: 2 }, xray: true }; // everything on layer 2
glitch.mask = null; // the whole image again
```

| Mask                                   | Limits the effect to                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `{ texture, channel }`                 | One channel (`r`, `g`, `b` or `a`; default `r`) of a texture covering the screen, for example a painted or video matte. |
| `{ depth: [near, far], feather }`      | Pixels between two distances from the camera, in scene units, with a soft edge `feather` units wide.                    |
| `{ selection: [objects] }`             | The visible pixels of these objects and their descendants. Objects in front still hide them.                            |
| `{ selection: { layer }, xray: true }` | Objects on a [layer](https://threejs.org/docs/#api/en/core/Layers); `xray` shows them through whatever is in front.     |

Every kind takes `invert: true`. A selection costs one extra render of the scene per distinct mask object; effects that share the same mask object share that render.

### How effects use their mask

Most effects fade by their mask: it scales their opacity per pixel, after their blend mode. A few use it differently, as their page says:

- [Outline](../effects/outline) traces the mask instead of the geometry, so a selection mask outlines just those objects.
- [Selective bloom](../effects/selective-bloom) and [glow](../effects/glow) use the mask as their light source; the glow still spreads over neighbouring pixels.
- [Buffer view](../effects/buffer-view) shows the mask itself, which helps when a mask doesn't look right.

## Geometry buffers

Effects declare the buffers they read. While any enabled effect needs depth, the scene renders into a depth texture; while one needs normals, the composer renders the scene once more with view-space normals. `composer.stats.depth` and `composer.stats.prepasses` show what the last frame used.

| Effect                                      | Reads                                        |
| ------------------------------------------- | -------------------------------------------- |
| [Depth fog](../effects/depth-fog)           | depth                                        |
| [Depth of field](../effects/depth-of-field) | depth                                        |
| [Outline](../effects/outline)               | depth, and normals unless `edges` is `depth` |
| Any effect with a depth mask                | depth                                        |

### Writing effects that read buffers

Declare the buffers and use the helpers the compiler adds to the pass:

```ts
export const heightTint = defineEffect({
  name: 'height-tint',
  meta: {/* … */},
  buffers: ['depth'],
  params: { color: color({ default: '#ff8800', description: 'Tint.' }) },
  fragment: /* glsl */ `
    vec4 $main(vec4 color, vec2 uv) {
      float height = xt_worldPosition(uv).y;
      return vec4(mix(color.rgb, $color, smoothstep(0.0, 2.0, height)), color.a);
    }`,
});
```

| Helper                 | Returns                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `xt_depth(uv)`         | The depth-buffer value: 0 at the near plane, 1 at the far plane and the sky |
| `xt_viewDepth(uv)`     | Distance in front of the camera, in scene units                             |
| `xt_viewPosition(uv)`  | View-space position                                                         |
| `xt_worldPosition(uv)` | World-space position                                                        |
| `xt_viewNormal(uv)`    | View-space normal from the normal buffer; zero where nothing was drawn      |
| `$maskAt(uv)`          | The effect's own mask, 1 where it applies (1 everywhere without a mask)     |

The camera-independent math (`xt_perspectiveDepthToViewZ`, `xt_viewPositionFromDepth`, `xt_normalFromDepth` …) is in the [`xtree/depth/reconstruct`](../reference/shaders#depth) chunk. Effects that handle their mask themselves declare `masking: 'custom'`.

### In three.js's EffectComposer

An `EffectPass` in three.js's own composer has no depth or normal buffers of its own. Render the scene into a target with a `DepthTexture` and pass it in before each frame:

```ts
pass.setGeometry({ depth: renderTarget.depthTexture, camera });
```

Selection masks need the xtree composer.
