# Introduction

xtree is a reusable library of three.js effects: screen-space post-processing, multi-pass effects such as bloom, material effects and transitions. The plan is a catalogue of about 140 effects in eleven families, all built on one composer that merges compatible effects into a single pass.

::: info Status: M3 beta
About 110 effects across every family, the merging composer, material effects, transitions, animation and interaction helpers, HoloCSS integration and performance tools. The API may still change before 1.0; breaking changes are listed in the changelog. Nothing is published to npm yet.
:::

## Guides

- [Getting started](./getting-started): install, the first effect on an existing three.js scene, and the HoloCSS stage path.
- [Composing stacks](./stacks): order, merging, blend modes, three.js passes and saving stacks.
- [Masks and geometry buffers](./masks): limit effects to textures, depth ranges or objects, and read depth and normals.
- [Material effects](./materials) and [transitions](./transitions).
- [HoloCSS themes and motion](./holocss): theme roles, the motion policy, stages and ambient scenes.
- [Animation and interaction](./animation): tweens, timelines, and pointer, tilt, audio and scroll bindings.
- [Performance](./performance): precompiling, adaptive quality, reduced resolution, benchmarks and mobile.
- [Motion, accessibility and photosensitivity](./accessibility).
- [Writing an effect](./custom-effects), [migrating](./migrating) from other composers, and [recipes](./recipes).

## Effect families

| Family                   | Examples                                                     |
| ------------------------ | ------------------------------------------------------------ |
| Color & tone             | Vignette, LUT grading, gradient map, levels, curves          |
| Lens & camera            | Chromatic aberration, film grain, depth of field, lens flare |
| Blur & glow              | Gaussian and Kawase blur, bloom, selective bloom, glow       |
| Glitch & signal          | RGB split, block displacement, datamosh, pixel sorting       |
| Retro & display          | Pixelate, dithering, CRT, VHS, palette reduction             |
| Stylization              | Outline, halftone, ASCII, Kuwahara, crosshatch               |
| Distortion & warp        | Ripple, displacement, heat haze, kaleidoscope                |
| Atmosphere & lighting    | Depth fog, SSAO, god rays, volumetric fog                    |
| Holographic & iridescent | Holographic foil, thin-film iridescence, hologram projection |
| Materials                | Dissolve, fresnel glow, force field, toon shading            |
| Transitions              | Luma wipe, glitch cut, pixel-sort wipe, holographic sweep    |

See the [roadmap](/project/) for the order in which they arrive.
