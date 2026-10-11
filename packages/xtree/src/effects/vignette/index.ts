import { color, defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Darkens or tints the frame toward its edges. */
export const vignette = defineEffect({
  name: 'vignette',
  meta: {
    title: 'Vignette',
    family: 'color',
    story: 'X3.4',
    description:
      'Darkens or tints the frame toward its edges, drawing the eye to the center.',
    related: ['chromatic-aberration', 'bloom'],
  },
  params: {
    darkness: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How strongly the edges move toward the vignette color.',
    }),
    offset: float({
      default: 0.5,
      min: 0,
      max: 1.5,
      step: 0.01,
      description:
        'Radius where the falloff starts, as a fraction of the half-diagonal.',
    }),
    smoothness: float({
      default: 0.6,
      min: 0.01,
      max: 1.5,
      step: 0.01,
      description: 'Width of the falloff (smooth mode).',
    }),
    roundness: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Smooth mode shape: 1 is a circle, 0 follows the frame aspect ratio.',
    }),
    color: color({
      theme: 'background',
      default: '#000000',
      description: 'Color the edges move toward.',
    }),
    mode: select({
      options: ['smooth', 'eskil'],
      default: 'smooth',
      description:
        'Smooth uses a smoothstep falloff; Eskil is the quadratic vignette from three.js examples.',
      optionLabels: { eskil: 'Eskil' },
    }),
  },
  presets: {
    subtle: { darkness: 0.35, offset: 0.7, smoothness: 0.8 },
    cinematic: {
      darkness: 0.85,
      offset: 0.35,
      smoothness: 0.75,
      roundness: 0.4,
    },
    tunnel: { darkness: 1, offset: 0.15, smoothness: 0.45 },
    glow: { darkness: 0.4, offset: 0.55, smoothness: 0.9, color: '#3b2a6b' },
  },
  fragment,
});
