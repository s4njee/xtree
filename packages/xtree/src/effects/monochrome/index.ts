import { color, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Greyscale, sepia, or a duotone between two colors. */
export const monochrome = defineEffect({
  name: 'monochrome',
  meta: {
    title: 'Monochrome',
    family: 'color',
    story: 'X3.6',
    description:
      'Greyscale, classic sepia, or a duotone that maps shadows and highlights to two colors.',
    related: ['gradient-map', 'hue-saturation'],
  },
  chunks: [colorSpaceChunks],
  params: {
    mode: select({
      options: ['grayscale', 'sepia', 'duotone'],
      default: 'grayscale',
      description: 'The kind of toning.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the toned image.',
    }),
    shadows: color({
      theme: 'background',
      default: '#1b1f3b',
      description: 'Duotone: the color of the darkest areas.',
    }),
    highlights: color({
      theme: 'text',
      default: '#ffd59e',
      description: 'Duotone: the color of the brightest areas.',
    }),
  },
  presets: {
    noir: { mode: 'grayscale' },
    sepia: { mode: 'sepia' },
    ocean: { mode: 'duotone', shadows: '#0b1d3a', highlights: '#7fe7ff' },
    sunset: { mode: 'duotone', shadows: '#2b0f3a', highlights: '#ffb36b' },
  },
  fragment,
});
