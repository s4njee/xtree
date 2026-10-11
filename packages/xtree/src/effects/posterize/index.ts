import { defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Flat bands of brightness with dark edges: a screen-space toon look. */
export const posterize = defineEffect({
  name: 'posterize',
  meta: {
    title: 'Toon posterize',
    family: 'stylize',
    story: 'X8.5',
    description:
      'Flattens brightness into a few bands while keeping each color’s hue, and darkens edges, for a cartoon look on any image.',
    related: ['edges', 'kuwahara', 'outline'],
  },
  chunks: [colorSpaceChunks],
  sampling: 'input',
  params: {
    bands: float({
      default: 4,
      min: 2,
      max: 12,
      step: 1,
      description: 'Number of brightness bands.',
    }),
    saturation: float({
      default: 1.2,
      min: 0,
      max: 2,
      step: 0.05,
      description: 'Color strength of the bands.',
    }),
    edges: float({
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How dark edges become.',
    }),
  },
  presets: {
    cartoon: { bands: 3, saturation: 1.4, edges: 0.9 },
    poster: { bands: 5, edges: 0 },
    comic: { bands: 4, edges: 1 },
    soft: { bands: 8, edges: 0.3, saturation: 1 },
  },
  fragment,
});
