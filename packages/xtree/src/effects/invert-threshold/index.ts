import { bool, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A photographic negative, or a hard (or soft) black-and-white threshold. */
export const invertThreshold = defineEffect({
  name: 'invert-threshold',
  meta: {
    title: 'Invert / threshold',
    family: 'color',
    story: 'X3.8',
    description:
      'A photographic negative, or a black-and-white threshold with an adjustable level and edge softness, optionally per channel for a posterized look.',
    related: ['monochrome', 'gradient-map'],
  },
  chunks: [colorSpaceChunks],
  params: {
    mode: select({
      options: ['invert', 'threshold'],
      default: 'threshold',
      description: 'Negative image, or split into dark and light.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the result.',
    }),
    level: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Threshold: the brightness that splits dark from light.',
    }),
    smoothness: float({
      default: 0.02,
      min: 0.001,
      max: 0.5,
      step: 0.001,
      description: 'Threshold: width of the soft edge around the level.',
    }),
    perChannel: bool({
      default: false,
      description:
        'Threshold red, green and blue separately for eight flat colors.',
    }),
  },
  presets: {
    negative: { mode: 'invert' },
    ink: { level: 0.22, smoothness: 0.01 },
    soft: { smoothness: 0.18 },
    posterized: { perChannel: true, level: 0.25, smoothness: 0.04 },
  },
  fragment,
});
