import { defineTransition, float, texture } from '../../effect/index.js';
import { noiseFbmChunks } from '../../shaders/maps.js';
import fragment from './transition.glsl';

/** A displacement-driven morph between two images. */
export const morph = defineTransition({
  name: 'morph',
  meta: {
    title: 'Morph',
    family: 'transition',
    story: 'X13.8',
    description:
      'Flows one image into the next along a displacement field: the old image is pushed away as it fades while the new one settles into place. The field is noise, or a displacement map of your own.',
    related: ['crossfade', 'flow-warp', 'zoom-transition'],
  },
  fallback: 'hcss-fold',
  chunks: [noiseFbmChunks],
  params: {
    strength: float({
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.005,
      description: 'How far the images are pushed, as a fraction of the frame.',
    }),
    scale: float({
      default: 2,
      min: 0.25,
      max: 16,
      step: 0.05,
      description: 'Noise field: size of the swirls (higher is finer).',
    }),
    map: texture({
      dimension: '2d',
      description:
        'A displacement map: red and green, centered on mid-gray, give the direction. Replaces the noise when set.',
    }),
  },
  presets: {
    liquid: { strength: 0.3, scale: 1.2 },
    ripple: { strength: 0.06, scale: 6 },
    subtle: { strength: 0.05 },
  },
  fragment,
});
