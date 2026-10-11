import { bool, defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** The frame sliced into bands that slide out of place. */
export const sliceShift = defineEffect({
  name: 'slice-shift',
  meta: {
    title: 'Slice shift',
    family: 'glitch',
    story: 'X6.9',
    description:
      'Cuts the frame into horizontal (or vertical) slices that slide out of line by random amounts, re-cutting a few times a second.',
    related: ['scanline-tear', 'block-displacement', 'rgb-split-glitch'],
  },
  sampling: 'input',
  chunks: [noiseHashChunks],
  motion: { settle: { density: 0 } },
  params: {
    slices: float({
      default: 12,
      min: 2,
      max: 80,
      step: 1,
      description: 'Number of slices across the frame.',
    }),
    offset: float({
      default: 0.08,
      min: 0,
      max: 0.5,
      step: 0.005,
      description: 'Largest slide, as a fraction of the frame.',
    }),
    density: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fraction of slices out of place at any moment.',
    }),
    rate: float({
      default: 2,
      min: 0,
      max: 2.5,
      step: 0.05,
      description:
        'Re-cuts per second for each slice (kept below 3 for photosensitivity).',
    }),
    vertical: bool({
      default: false,
      description: 'Vertical slices that slide up and down.',
    }),
    seed: int({
      default: 0,
      min: 0,
      max: 99,
      step: 1,
      description: 'Picks a different pattern of slices.',
    }),
  },
  presets: {
    subtle: { offset: 0.02, density: 0.25 },
    shattered: { slices: 40, offset: 0.15, density: 0.6 },
    vertical: { vertical: true, slices: 16 },
    frozen: { rate: 0, density: 0.5 },
  },
  fragment,
});
