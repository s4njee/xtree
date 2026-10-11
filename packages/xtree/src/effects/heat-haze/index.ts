import { defineEffect, float, seed } from '../../effect/index.js';
import { noiseSimplexChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Shimmering air over a hot surface. */
export const heatHaze = defineEffect({
  name: 'heat-haze',
  meta: {
    title: 'Heat haze',
    family: 'distortion',
    story: 'X9.3',
    description:
      'The shimmer of hot air: the image wobbles in small, rising ripples, strongest near the bottom. Give it a mask to haze only above a fire or a road.',
    related: ['ripple', 'flow-warp', 'displacement-map'],
  },
  sampling: 'input',
  chunks: [noiseSimplexChunks],
  motion: 'freeze',
  params: {
    strength: float({
      default: 4,
      min: 0,
      max: 20,
      step: 0.25,
      unit: 'px',
      description: 'How far the haze bends the image.',
    }),
    scale: float({
      default: 40,
      min: 5,
      max: 200,
      step: 1,
      unit: 'px',
      description: 'Size of the ripples.',
    }),
    speed: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'How fast the ripples rise.',
    }),
    rise: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much stronger the haze is at the bottom than the top.',
    }),
    seed: seed(),
  },
  presets: {
    desert: { strength: 8, scale: 60, speed: 0.8 },
    subtle: { strength: 2, scale: 30 },
    jetExhaust: { strength: 12, scale: 20, speed: 3, rise: 0 },
    mirage: { strength: 6, scale: 120, speed: 0.5, rise: 1 },
  },
  fragment,
});
