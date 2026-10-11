---
title: Animation and interaction
description: Tween parameters with CSS easing, scrub timelines across effects, and drive effects from the pointer, device tilt, audio and scroll.
---

# Animation and interaction

`@mk7s/xtree/animation` animates any effect's parameters, and binds them to input. It works on post effects, material effects and transitions alike, through each effect's own setters, so values are validated and uniforms update without recompiling.

## Tweening

`animate` moves parameters to new values like a CSS transition, with the same easing strings: keywords, `cubic-bezier()`, `steps()` and `linear()`.

```ts
import { animate } from '@mk7s/xtree/animation';

const glow = bloom();
const run = animate(
  glow,
  { intensity: 2, threshold: 0.6 },
  {
    duration: 600,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  },
);
await run.finished; // 'finished', or 'canceled'
```

Numbers and vectors interpolate, integers round, colors blend in linear light, and other values (selects, booleans) switch at the end. Pass `signal` to cancel with an `AbortController`. Animating a parameter that is already animating takes over from the running animation. With `motion: false` (for example from `motionAllowed(element)`), the values are set at once.

## Timelines

A `timeline` places keyframes for several effects on one 0–1 axis. Set `progress` to scrub it: from a scroll position, a slider, or your own clock. Between keyframes each parameter interpolates with the earlier keyframe's easing, and before the first keyframe that sets a parameter it holds.

```ts
import { bindScroll, timeline } from '@mk7s/xtree/animation';

const story = timeline([
  {
    target: glow,
    keyframes: [
      { at: 0, values: { intensity: 0 } },
      { at: 0.3, values: { intensity: 1.4 }, easing: 'ease-in-out' },
    ],
  },
  {
    target: grey,
    keyframes: [
      { at: 0.65, values: { amount: 0 } },
      { at: 1, values: { amount: 1 } },
    ],
  },
]);
bindScroll(story, { scroller: panel });
```

Scroll the panel below to scrub this timeline across bloom, chromatic aberration, film grain, monochrome and a vignette:

<ScrollStory />

## Input bindings

Each binding returns a function that stops it and puts the parameter back.

| Binding                                                  | Drives a parameter from                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `followPointer(effect, 'center', { element })`           | The pointer over `element`, smoothed. As with HoloCSS's `createTilt`, only fine, hover-capable pointers drive it: touch and coarse pointers leave it at rest, and leaving the element returns it to rest.                 |
| `bindOrientation(effect, 'tilt', { element })`           | How the device is tilted, around the pose of the first reading. It follows the pointer until orientation events arrive. On iOS they only arrive after `requestOrientationPermission()`, called from a tap.                |
| `bindAudio(effect, analyser, { param, band })`           | A frequency band (bass, mid, treble or level) of an `AnalyserNode` you create. Opt-in: nothing is captured here, and a suspended `AudioContext` resumes on the next user gesture.                                         |
| `bindScroll(effect, 'amount')` or `bindScroll(timeline)` | Scroll progress: 0 at the start of the scroller's range and 1 at the end, as HoloCSS's `scrollProgress` reads it. It uses a native `ScrollTimeline` where the browser has one and measures the scroll position otherwise. |

`vec2` parameters receive both axes across their range; numbers receive x (or the progress). Pass `map` to convert the input yourself.

Audio-reactive and pointer-reactive motion are decorative: never put information only in them, and follow the [motion policy](./accessibility) so they stop when motion is off.

## Seeds

Every effect with a random pattern (grain, noise, dissolves, glitches) takes a `seed`. The same seed always renders the same frames, which keeps screenshots and tests stable, and another seed gives an unrelated pattern. Write your own effects' noise as `xt_seeded(coordinates, $seed)` to follow the same rule.
