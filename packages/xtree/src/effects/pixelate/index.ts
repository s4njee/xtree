import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Big square, hexagonal or round pixels. */
export const pixelate = defineEffect({
  name: 'pixelate',
  meta: {
    title: 'Pixelate',
    family: 'retro',
    story: 'X7.1',
    description:
      'Big square, hexagonal or round pixels, each the color at its center.',
    related: ['dither', 'halftone', 'ascii'],
  },
  sampling: 'input',
  params: {
    size: float({
      default: 8,
      min: 1,
      max: 64,
      step: 1,
      unit: 'px',
      description: 'Size of a cell.',
    }),
    shape: select({
      options: ['square', 'hex', 'dots'],
      default: 'square',
      description: 'Cell shape.',
    }),
    gap: float({
      default: 0.15,
      min: 0,
      max: 0.6,
      step: 0.01,
      description: 'Dots: space between dots, as a fraction of a cell.',
    }),
  },
  presets: {
    chunky: { size: 16 },
    fine: { size: 4 },
    hex: { shape: 'hex', size: 12 },
    dots: { shape: 'dots', size: 10, gap: 0.15 },
  },
  fragment,
});
