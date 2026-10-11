---
title: Composing stacks
description: How effects order, merge into passes and blend; mixing in three.js passes; masks; and saving stacks as JSON or a URL.
---

# Composing stacks

An `EffectComposer` renders your scene once and then runs a **stack**: effects in order, each reading the result of the ones before it.

```ts
import { EffectComposer } from '@mk7s/xtree/core';

const composer = new EffectComposer(renderer).setScene(scene, camera);
composer.add(bloom(), chromaticAberration(), vignette());
composer.remove(vignette);
composer.setItems([bloom, filmGrain()]); // replace the whole stack
```

## Order

Order matters the way layers do in an image editor. A few rules of thumb:

1. **Lens and light first.** Bloom, flares, depth of field and motion blur model the camera, so they work on the scene's HDR light before anything stylizes it.
2. **Color and tone next.** Grading, levels and curves expect a natural image.
3. **Stylization and glitches after.** Pixel art, dithering, CRT and VHS treat the graded image as their source.
4. **Grain, scanlines and vignettes last.** They sit on top of everything, as they would on film or a screen.

Effects work in linear HDR light before tone mapping, which the composer applies at the end (from `renderer.toneMapping`). That is why bloom picks up highlights above 1 and why grading keeps them.

## Merging

The composer merges effects into as few full-screen passes as it can, so a long stack of cheap effects costs about as much as one.

- Effects that read only **their own pixel** (most color, tone, grain and vignette effects) merge into the pass before them.
- Effects that **sample the image elsewhere** (blurs, distortions, edges) start a new pass, because they need the finished result of everything before them. Pixel effects after them join that new pass.
- Some effects also render **their own passes** first, such as bloom's mip chain or ambient occlusion's buffer. Each effect page lists this under **Details**.

`composer.describe()` lists the passes the stack became, and the [debug overlay](/api/core/functions/createDebugOverlay) shows them live. Set `composer.merge = false` to give every effect its own pass while debugging.

## Blending and opacity

Every effect has a `blend` mode and an `opacity`, applied after it runs. The modes are those of CSS and image editors: `normal`, `darken`, `multiply`, `colorBurn`, `linearBurn`, `darkerColor`, `lighten`, `screen`, `colorDodge`, `add`, `lighterColor`, `overlay`, `softLight`, `hardLight`, `vividLight`, `linearLight`, `pinLight`, `hardMix`, `difference`, `exclusion`, `subtract`, `divide`, `hue`, `saturation`, `color` and `luminosity`.

```ts
const tint = gradientMap({ blend: 'softLight', opacity: 0.6 });
tint.enabled = false; // skipped without leaving the stack
```

## Masks and selections

Any effect can be limited to a texture, a depth range or selected objects. See [masks and geometry buffers](./masks).

## three.js passes

A stack can mix xtree effects with passes from `three/examples/jsm/postprocessing` (or any object with the three.js `Pass` interface). The composer runs them in order, breaking merged passes around them:

```ts
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
composer.add(bloom(), new FilmPass(), vignette());
```

xtree passes also work inside three.js's own `EffectComposer`; see [migrating](./migrating).

## Saving and sharing stacks

Stacks serialize to plain JSON, or to a URL-safe string, with every parameter that differs from its default:

```ts
import { EffectStack } from '@mk7s/xtree/effect';
import { bloom } from '@mk7s/xtree/effects/bloom';
import { vignette } from '@mk7s/xtree/effects/vignette';

const json = EffectStack.toJSON(composer.effects);
// The registry: the factories a stack may contain.
const restored = EffectStack.fromJSON(json, { bloom, vignette });
const link = `?stack=${EffectStack.encode(composer.effects)}`;
```

Unknown effects and parameters are skipped with a warning, so older links keep working. Texture and selection masks hold live objects and are left out.
