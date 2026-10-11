import { color, defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Stained glass: irregular cells of flat color with lead lines. */
export const mosaic = defineEffect({
  name: 'mosaic',
  meta: {
    title: 'Mosaic & stained glass',
    family: 'stylize',
    story: 'X8.10',
    description:
      'Breaks the image into irregular cells (a Voronoi mosaic), each filled with one color and outlined in lead, like stained glass or tiles.',
    related: ['pixelate', 'kuwahara', 'halftone'],
  },
  sampling: 'input',
  chunks: [noiseHashChunks],
  params: {
    cellSize: float({
      default: 18,
      min: 4,
      max: 80,
      step: 1,
      unit: 'px',
      description: 'Average size of a cell.',
    }),
    jitter: float({
      default: 0.9,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Irregularity of the cells: 0 is a square grid.',
    }),
    lineWidth: float({
      default: 0.08,
      min: 0,
      max: 0.4,
      step: 0.005,
      description: 'Width of the lead lines, relative to a cell.',
    }),
    lead: color({
      default: '#15141a',
      description: 'Color of the lines between cells.',
    }),
    glow: float({
      default: 1.15,
      min: 0.5,
      max: 2,
      step: 0.01,
      description: 'Brightness of the glass, as if lit from behind.',
    }),
    seed: int({
      default: 0,
      min: 0,
      max: 99,
      step: 1,
      description: 'Picks a different pattern of cells.',
    }),
  },
  presets: {
    cathedral: { cellSize: 26, lineWidth: 0.12, glow: 1.4 },
    tiles: { jitter: 0.2, lineWidth: 0.06, lead: '#e6e1d6', glow: 1 },
    fine: { cellSize: 8, lineWidth: 0.05 },
    crystals: { cellSize: 40, lineWidth: 0.02, glow: 1.2 },
  },
  fragment,
});
