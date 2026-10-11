import { color, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Two-color toning: one tint for the shadows, another for the highlights. */
export const splitToning = defineEffect({
  name: 'split-toning',
  meta: {
    title: 'Split toning',
    family: 'color',
    story: 'X3.14',
    description:
      'Tints the shadows with one color and the highlights with another, keeping brightness, like a darkroom split tone or a modern teal-and-orange grade.',
    related: ['color-balance', 'gradient-map', 'monochrome'],
  },
  chunks: [colorSpaceChunks],
  params: {
    shadows: color({
      default: '#1f6f8b',
      description: 'Tint for the shadows.',
    }),
    highlights: color({
      default: '#f2a65a',
      description: 'Tint for the highlights.',
    }),
    balance: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Moves the split: positive gives the shadow tint more of the image.',
    }),
    amount: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the toning.',
    }),
  },
  presets: {
    tealOrange: { amount: 0.6 },
    sepiaSelenium: { shadows: '#40506b', highlights: '#c8a46e', amount: 0.6 },
    cyberpunk: { shadows: '#2a1b6e', highlights: '#ff4fa3', amount: 0.55 },
    sunset: { shadows: '#6b2d5c', highlights: '#ffc15e', balance: 0.2 },
  },
  fragment,
});
