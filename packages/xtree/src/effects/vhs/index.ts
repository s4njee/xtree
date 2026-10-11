import { bool, defineEffect, float, seed } from '../../effect/index.js';
import {
  colorSpaceChunks,
  noiseHashChunks,
  noiseValueChunks,
} from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A worn VHS tape: wobble, color bleed, tracking noise and the on-screen display. */
export const vhs = defineEffect({
  name: 'vhs',
  meta: {
    title: 'VHS',
    family: 'retro',
    story: 'X7.5',
    description:
      'A worn VHS tape: wobbling lines, colors bleeding to the right of edges, a rolling tracking band, head-switching noise at the bottom and a PLAY display with a tape counter.',
    related: ['scanlines', 'crt', 'ntsc'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks, noiseHashChunks, noiseValueChunks],
  motion: { settle: { tracking: 0, noise: 0, wobble: 0 } },
  params: {
    wobble: float({
      default: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description: 'Horizontal wobble of the tape.',
    }),
    bleed: float({
      default: 6,
      min: 0,
      max: 24,
      step: 0.5,
      unit: 'px',
      description: 'How far colors smear to the right.',
    }),
    saturation: float({
      default: 0.85,
      min: 0,
      max: 1.5,
      step: 0.01,
      description: 'Color strength after the tape.',
    }),
    tracking: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the rolling tracking band.',
    }),
    headSwitching: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Skew and noise in the bottom lines.',
    }),
    noise: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Luma noise.',
    }),
    onScreenDisplay: bool({
      default: true,
      description: 'Show PLAY and a tape counter.',
    }),
    seed: seed(),
  },
  presets: {
    rental: { wobble: 1, tracking: 0.8, noise: 0.5 },
    clean: { wobble: 0.2, tracking: 0, noise: 0.1, headSwitching: 0.2 },
    faded: { saturation: 0.5, bleed: 12 },
    noDisplay: { onScreenDisplay: false },
  },
  fragment,
});
