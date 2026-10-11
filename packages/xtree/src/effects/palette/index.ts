import { color, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks, ditherOrderedChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Limits the image to a classic hardware palette. */
export const palette = defineEffect({
  name: 'palette',
  meta: {
    title: 'Palette reduction',
    family: 'retro',
    story: 'X7.6',
    description:
      'Repaints the image with only the colors of a classic palette (Game Boy, CGA, EGA, PICO-8, Commodore 64, NES, or four of your own), matched by perceived difference, with optional dithering.',
    related: ['dither', 'bit-crush', 'pixelate'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks, ditherOrderedChunks],
  params: {
    palette: select({
      options: ['gameBoy', 'cga', 'ega', 'pico8', 'c64', 'nes', 'custom'],
      default: 'pico8',
      structural: true,
      description: 'The palette to repaint with.',
      optionLabels: {
        gameBoy: 'Game Boy',
        cga: 'CGA',
        ega: 'EGA',
        pico8: 'PICO-8',
        c64: 'Commodore 64',
        nes: 'NES',
      },
    }),
    dither: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Ordered dithering between palette colors.',
    }),
    pixelSize: float({
      default: 1,
      min: 1,
      max: 16,
      step: 1,
      unit: 'px',
      description: 'Size of each output pixel.',
    }),
    color1: color({
      default: '#1a1c2c',
      description: 'Custom palette: first color.',
    }),
    color2: color({
      default: '#5d275d',
      description: 'Custom palette: second color.',
    }),
    color3: color({
      default: '#ef7d57',
      description: 'Custom palette: third color.',
    }),
    color4: color({
      default: '#f4f4f4',
      description: 'Custom palette: fourth color.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the repainted image.',
    }),
  },
  presets: {
    gameBoy: { palette: 'gameBoy', pixelSize: 2, dither: 0.6 },
    cga: { palette: 'cga', pixelSize: 2, dither: 0.8 },
    nes: { palette: 'nes', pixelSize: 3, dither: 0.2 },
    c64: { palette: 'c64', pixelSize: 3, dither: 0.4 },
  },
  fragment,
});
