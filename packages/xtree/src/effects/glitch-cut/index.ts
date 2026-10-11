import { defineTransition, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './transition.glsl';

/** A cut that breaks up into glitch blocks, slices and channel splits. */
export const glitchCut = defineTransition({
  name: 'glitch-cut',
  meta: {
    title: 'Glitch cut',
    family: 'transition',
    story: 'X13.4',
    description:
      'Cuts to the next image through digital damage: blocks flip over one by one around the middle while slices shift and the color channels split. The damage fades in and out with the transition, and blocks switch at staggered moments so the frame never flashes as a whole.',
    related: ['rgb-split-glitch', 'slice-shift', 'pixelate-transition'],
  },
  fallback: 'hcss-depth',
  chunks: [noiseHashChunks],
  params: {
    blockSize: float({
      default: 32,
      min: 4,
      max: 128,
      step: 1,
      unit: 'px',
      description: 'Size of the blocks that switch.',
    }),
    spread: float({
      default: 0.6,
      min: 0,
      max: 0.98,
      step: 0.01,
      description:
        'How much of the transition the block switching is spread over.',
    }),
    slices: float({
      default: 24,
      min: 2,
      max: 120,
      step: 1,
      description: 'Number of horizontal slices.',
    }),
    density: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fraction of slices that shift.',
    }),
    shift: float({
      default: 0.08,
      min: 0,
      max: 0.5,
      step: 0.005,
      description:
        'Largest sideways shift of a slice, as a fraction of the width.',
    }),
    split: float({
      default: 12,
      min: 0,
      max: 60,
      step: 0.5,
      unit: 'px',
      description: 'Largest color channel split.',
    }),
    steps: int({
      default: 3,
      min: 1,
      max: 6,
      step: 1,
      description:
        'How many times the slices re-roll across the transition; kept low so a one-second cut stays within the flash limit.',
    }),
  },
  presets: {
    subtle: { shift: 0.03, split: 4, density: 0.25 },
    heavy: { shift: 0.12, split: 20, density: 0.5, blockSize: 48 },
    fine: { blockSize: 8, slices: 60 },
    instant: { spread: 0.1, steps: 2 },
  },
  fragment,
});
