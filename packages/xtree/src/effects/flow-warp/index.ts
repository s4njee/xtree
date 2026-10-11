import { defineEffect, float, seed } from '../../effect/index.js';
import { noiseSimplexChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A liquid swirl from a curl-noise flow field. */
export const flowWarp = defineEffect({
  name: 'flow-warp',
  meta: {
    title: 'Liquid flow warp',
    family: 'distortion',
    story: 'X9.9',
    description:
      'Swirls the image through a slowly changing flow field (curl noise), so it moves like ink in water without tearing.',
    related: ['heat-haze', 'wave-warp', 'twirl'],
  },
  sampling: 'input',
  chunks: [noiseSimplexChunks],
  motion: 'freeze',
  params: {
    strength: float({
      default: 4,
      min: 0,
      max: 20,
      step: 0.1,
      description: 'How far the flow carries the image.',
    }),
    scale: float({
      default: 2,
      min: 0.25,
      max: 10,
      step: 0.05,
      description: 'Size of the swirls: higher values make smaller ones.',
    }),
    speed: float({
      default: 0.5,
      min: 0,
      max: 3,
      step: 0.05,
      description: 'How fast the flow changes.',
    }),
    seed: seed(),
  },
  presets: {
    ink: { strength: 6, scale: 1.5, speed: 0.3 },
    psychedelic: { strength: 14, scale: 3, speed: 1 },
    gentle: { strength: 2, scale: 1 },
    marble: { strength: 10, scale: 4, speed: 0 },
  },
  fragment,
});
