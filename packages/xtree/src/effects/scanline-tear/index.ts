import { defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Bands of scanlines slip sideways and wrap around, like a TV losing horizontal sync. */
export const scanlineTear = defineEffect({
  name: 'scanline-tear',
  meta: {
    title: 'Scanline tear',
    family: 'glitch',
    story: 'X6.3',
    description:
      'Bands of scanlines slip sideways and wrap around, with an optional sinusoidal wobble, like a TV losing horizontal sync.',
    related: ['block-displacement', 'scanlines', 'crt'],
  },
  sampling: 'input',
  motion: { settle: { frequency: 0, wave: 0 } },
  chunks: [noiseHashChunks],
  params: {
    amount: float({
      default: 0.03,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: 'Largest sideways shift, as a fraction of the width.',
    }),
    lineHeight: float({
      default: 6,
      min: 1,
      max: 64,
      step: 1,
      unit: 'px',
      description: 'Height of a band that moves together.',
    }),
    frequency: float({
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fraction of bands torn at any moment.',
    }),
    wave: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of a slow sinusoidal wobble.',
    }),
    speed: float({
      default: 1,
      min: 0,
      max: 10,
      step: 0.1,
      description: 'Speed of the wobble.',
    }),
    seed: int({
      default: 1,
      min: 0,
      max: 9999,
      step: 1,
      description: 'Changes the random sequence.',
    }),
  },
  presets: {
    subtle: { amount: 0.01, frequency: 0.08, wave: 0.15 },
    lostSync: { amount: 0.12, frequency: 0.3, lineHeight: 12 },
    wobble: { frequency: 0, wave: 1, amount: 0.04 },
    shredded: { amount: 0.2, frequency: 0.5, lineHeight: 2 },
  },
  fragment,
});
