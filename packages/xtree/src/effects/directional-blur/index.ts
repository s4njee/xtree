import { defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A straight-line blur at any angle, like a whip pan. */
export const directionalBlur = defineEffect({
  name: 'directional-blur',
  meta: {
    title: 'Directional blur',
    family: 'glow',
    story: 'X5.6',
    description:
      'Smears the image along one direction, like a fast camera pan or a streak of speed.',
    related: ['radial-blur', 'motion-blur', 'blur'],
  },
  sampling: 'input',
  chunks: [noiseHashChunks],
  params: {
    angle: float({
      default: 0,
      min: 0,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Direction of the smear; 0 is horizontal.',
    }),
    length: float({
      default: 24,
      min: 0,
      max: 200,
      step: 1,
      unit: 'px',
      description: 'Length of the smear in pixels.',
    }),
    samples: int({
      default: 24,
      min: 4,
      max: 64,
      step: 1,
      description: 'Samples per pixel; more are smoother and cost more.',
    }),
  },
  quality: { low: { samples: 10 }, medium: { samples: 16 } },
  presets: {
    pan: { length: 60, samples: 32 },
    vertical: { angle: 90, length: 40 },
    diagonal: { angle: 35, length: 32 },
    whip: { length: 140, samples: 48 },
  },
  fragment,
});
