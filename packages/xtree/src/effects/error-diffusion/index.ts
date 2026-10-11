import { bool, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Floyd–Steinberg or Atkinson dithering, approximated per tile on the GPU. */
export const errorDiffusion = defineEffect({
  name: 'error-diffusion',
  meta: {
    title: 'Error-diffusion dither',
    family: 'retro',
    story: 'X7.8',
    description:
      'The organic dither of Floyd–Steinberg and of the classic Mac’s Atkinson, approximated on the GPU in 4×4 tiles: few colors, with the rounding error spread to neighboring pixels.',
    related: ['dither', 'palette', 'bit-crush'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    method: select({
      options: ['floydSteinberg', 'atkinson'],
      default: 'floydSteinberg',
      structural: true,
      description:
        'Floyd–Steinberg keeps tones; Atkinson drops some error for punchier contrast.',
      optionLabels: { floydSteinberg: 'Floyd–Steinberg' },
    }),
    levels: float({
      default: 2,
      min: 2,
      max: 8,
      step: 1,
      description: 'Levels per channel.',
    }),
    monochrome: bool({
      default: true,
      description: 'Dither brightness only, in black and white.',
    }),
    pixelSize: float({
      default: 2,
      min: 1,
      max: 8,
      step: 1,
      unit: 'px',
      description: 'Size of each dithered pixel.',
    }),
  },
  presets: {
    macintosh: { method: 'atkinson', pixelSize: 2 },
    newspaper: { pixelSize: 1 },
    color: { monochrome: false, levels: 3 },
    chunky: { pixelSize: 4, method: 'atkinson' },
  },
  fragment,
});
