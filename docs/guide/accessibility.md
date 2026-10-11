---
title: Motion, accessibility and photosensitivity
description: How xtree keeps animated effects still until you start them, follows reduced-motion settings, and checks effects against WCAG 2.3.1 flash limits.
---

# Motion, accessibility and photosensitivity

Post-processing is decorative: it changes how a scene looks, not what it says. xtree's defaults keep it that way, and the tools below help you keep animated effects safe and under the viewer's control.

## Nothing moves until you start it

A composer holds animated effects still until `composer.play()` (WCAG 2.2.2: motion the user didn't start must be pausable). Call `play()` from your own play control or once the user has interacted, and `pause()` to stop.

```ts
const composer = new EffectComposer(renderer).add(filmGrain(), hologram());
playButton.onclick = () =>
  composer.playing ? composer.pause() : composer.play();
```

## Following the motion policy

`bindMotion` turns motion off when the viewer asks for less of it, and back on when they stop:

- the operating system's **reduced motion** setting (`prefers-reduced-motion: reduce`);
- `data-hcss-motion="none"` on the element or an ancestor, which is HoloCSS's motion switch (the switch in this site's header sets it);
- the `high-contrast` HoloCSS theme, and `prefers-contrast: more` while the theme is `auto`.

```ts
import { bindMotion } from '@mk7s/xtree/motion'; // or '@mk7s/xtree/holocss' with HoloCSS installed

const unbind = bindMotion([composer, hologramMaterial], canvas);
```

With motion off, time stops and every animated effect shows a still frame. Each effect declares how: `freeze` holds the current frame, and `settle` swaps in still values (a glitch keeps its offset but stops jumping). Every effect page says which under **Details**, and a browser test checks that no effect changes while motion is off. [Animations](./animation) take a `motion` option that sets values at once instead of tweening.

## Photosensitivity

Rapid flashing can trigger seizures. WCAG 2.3.1 allows no more than three general or red flashes in any second over a large enough area of the screen. Every animated xtree effect, preset and transition is checked against that limit in the browser tests, using the analyser in `@mk7s/xtree/safety`. Where an effect could flash it is designed not to:

- glitches and static change at staggered moments per region, slowly enough to stay under the limit;
- sweeps and wipes draw a thin glowing line rather than a wide band, and glow parameters note the safe range ("above about 0.6…");
- transitions are checked played over one second.

You can check your own stacks and effects the same way. Capture frames (RGBA8, as displayed) and analyse them:

```ts
import { analyseFlashes } from '@mk7s/xtree/safety';

const report = analyseFlashes(frames, { fps: 30 });
if (!report.pass) console.warn(report.generalPerSecond, report.redPerSecond);
```

The analyser is a development and CI tool, not a substitute for a full Harding or PEAT analysis of finished content. Parameters can always be pushed past safe values, so test the settings you ship.

## Other good habits

- Mark decorative canvases `aria-hidden="true"`, and give meaningful scenes a text alternative.
- Never put information only in an effect: a pulsing glow can draw attention, but the state it signals should also be in text or an accessible control.
- Audio-reactive effects are opt-in and should stay decorative.
- Keep [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) when effects run behind content: vignettes, fog and grain can lower it.
