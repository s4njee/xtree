---
title: Recipes
description: 'Ready-made stacks for common looks: cyberpunk, retro arcade, film, a holographic trading card and polished data visualizations.'
---

# Recipes

Starting points for common looks. Each is a few effects with presets; tune from there on the effects' pages. Order follows the rules in [composing stacks](./stacks): light first, then color, then stylization, then grain.

## Cyberpunk

Neon bloom, teal-and-magenta toning, a slight lens fringe and a HUD overlay in the theme accent.

```ts
composer.add(
  bloom({ preset: 'neon' }),
  splitToning({ preset: 'cyberpunk' }),
  chromaticAberration({ preset: 'subtle' }),
  hudGrid({ preset: 'subtle' }),
  scanlines({ preset: 'subtle' }),
  vignette({ preset: 'cinematic' }),
);
```

## Retro arcade

A low-resolution, limited palette on a curved CRT with glowing phosphors.

```ts
composer.add(
  palette({ preset: 'nes', pixelSize: 3 }),
  crt({ preset: 'arcade' }),
  bloom({ preset: 'subtle' }),
);
```

Swap the palette for `gameBoy` or `cga`, or use [`pixelate`](../effects/pixelate) and [`dither`](../effects/dither) for a softer version.

## Film look

Halation around highlights, anamorphic streaks, a filmic grade and grain.

```ts
composer.add(
  halation({ preset: 'film' }),
  anamorphic({ preset: 'subtle' }),
  colorBalance({ preset: 'filmic' }),
  bleachBypass({ preset: 'subtleBleach' }),
  filmGrain({ preset: 'fine' }),
  vignette({ preset: 'subtle' }),
);
```

## Holographic trading card

Foil on the card's material, a sparkle of glitter and a fresnel rim, tilting with the pointer (or the phone).

```ts
import { bindOrientation } from '@mk7s/xtree/animation';

const foil = foilMaterial({ preset: 'card' });
patchMaterial(
  card.material,
  foil,
  fresnelGlow({ preset: 'selected', pulse: 0 }),
);
const sparkle = glitter({ preset: 'holo' });
composer.add(sparkle, bloom({ preset: 'subtle' }));
bindOrientation(holographicFoil({ preset: 'card' }), 'tilt', {
  element: canvas,
});
```

Glitter and foil are animated: start them with `composer.play()` and follow the [motion policy](./accessibility), which stills them when motion is off.

## Data-viz polish

Depth for 3D charts without distracting from the data: soft contact shadows, gentle depth fog, crisp outlines on selected series and a light bloom on highlights.

```ts
composer.add(
  ssao({ preset: 'contact' }),
  depthFog({ preset: 'haze' }),
  outline({ mask: { selection: [selectedSeries] } }),
  bloom({ preset: 'subtle' }),
);
```

Keep color effects off charts whose colors encode values. A showcase on a Holochart canvas, in HoloCSS's shared-renderer mode, is planned (X15.6).
