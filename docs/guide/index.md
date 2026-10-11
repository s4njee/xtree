# Introduction

xtree is a reusable library of three.js effects: screen-space post-processing, multi-pass effects such as bloom, material effects and transitions. The plan is a catalogue of about 140 effects in eleven families, all built on one composer that merges compatible effects into a single pass.

::: warning Status: M0 (foundation)
The repository has its tooling, documentation site and shader chunk library. The composer and the first effects arrive in M1. Nothing is published to npm yet.
:::

## What exists today

- **Shader chunks.** Tested GLSL building blocks for [noise](/reference/shaders#noise), [color](/reference/shaders#color) and [blend modes](/reference/shaders#blend), plus the `resolveIncludes` function that assembles them.
- **Tooling.** Size budgets for every export, a GLSL lint backed by `glslangValidator`, a check of every shader's licence, and browser tests that check each chunk on the GPU against CPU reference implementations.
- **This site.** Built with VitePress and styled with [HoloCSS](https://github.com/s4njee/holocss) theme roles.

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
