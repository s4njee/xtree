import { curve, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

const identity = [
  [0, 0],
  [1, 1],
] as const;

/** Tone curves: a master curve and one per channel, as in a photo editor. */
export const curves = defineEffect({
  name: 'curves',
  meta: {
    title: 'Curves',
    family: 'color',
    story: 'X3.10',
    description:
      'Tone curves like a photo editor’s: a master curve for contrast and one curve per channel for color, through smooth points that never overshoot.',
    related: ['levels', 'color-balance', 'lut'],
  },
  chunks: [colorSpaceChunks],
  params: {
    master: curve({
      default: identity,
      description: 'Maps input brightness (x) to output (y) for every channel.',
    }),
    red: curve({ default: identity, description: 'The red channel’s curve.' }),
    green: curve({
      default: identity,
      description: 'The green channel’s curve.',
    }),
    blue: curve({
      default: identity,
      description: 'The blue channel’s curve.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the curved image.',
    }),
  },
  presets: {
    contrast: {
      master: [
        [0, 0],
        [0.25, 0.18],
        [0.75, 0.84],
        [1, 1],
      ],
    },
    fade: {
      master: [
        [0, 0.1],
        [0.5, 0.52],
        [1, 0.92],
      ],
    },
    crossProcess: {
      red: [
        [0, 0],
        [0.3, 0.22],
        [0.7, 0.8],
        [1, 1],
      ],
      green: [
        [0, 0.03],
        [0.5, 0.55],
        [1, 1],
      ],
      blue: [
        [0, 0.12],
        [0.5, 0.45],
        [1, 0.85],
      ],
    },
    moody: {
      master: [
        [0, 0.05],
        [0.3, 0.22],
        [0.7, 0.72],
        [1, 0.95],
      ],
      blue: [
        [0, 0.08],
        [0.5, 0.5],
        [1, 0.95],
      ],
    },
  },
  fragment,
});
