import { defineEffect, float, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** A magnifying (or pinching) lens over a circle. */
export const bulge = defineEffect({
  name: 'bulge',
  meta: {
    title: 'Bulge & pinch',
    family: 'distortion',
    story: 'X9.8',
    description:
      'A round lens that magnifies the image toward its center (bulge) or squeezes it (pinch). In the demo it follows the pointer.',
    related: ['twirl', 'fisheye', 'lens-distortion'],
  },
  sampling: 'input',
  params: {
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Center of the lens (follows the pointer in the demo).',
    }),
    radius: float({
      default: 0.3,
      min: 0.05,
      max: 1,
      step: 0.01,
      description: 'Radius of the lens, as a fraction of the frame height.',
    }),
    strength: float({
      default: 0.5,
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Positive magnifies, negative pinches.',
    }),
  },
  presets: {
    magnifier: { strength: 0.8, radius: 0.2 },
    pinch: { strength: -0.6 },
    subtle: { strength: 0.25, radius: 0.5 },
    bubble: { strength: 1, radius: 0.35 },
  },
  fragment,
});
