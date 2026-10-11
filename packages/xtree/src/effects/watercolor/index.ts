import { color, defineEffect, float, seed } from '../../effect/index.js';
import {
  colorSpaceChunks,
  noiseValueChunks,
  samplingSpiralChunks,
} from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A watercolor painting: soft washes, wobbling edges, pooled pigment, paper grain. */
export const watercolor = defineEffect({
  name: 'watercolor',
  meta: {
    title: 'Watercolor',
    family: 'stylize',
    story: 'X8.9',
    description:
      'Paints the image in watercolor: soft washes that bleed and waver, darker rims where pigment pools, and grain where it settles into the paper.',
    related: ['kuwahara', 'pencil', 'posterize'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks, noiseValueChunks, samplingSpiralChunks],
  params: {
    bleed: float({
      default: 4,
      min: 0,
      max: 16,
      step: 0.25,
      unit: 'px',
      description: 'How far colors bleed into each other.',
    }),
    wobble: float({
      default: 4,
      min: 0,
      max: 16,
      step: 0.25,
      unit: 'px',
      description: 'How much edges waver.',
    }),
    edgeDarkening: float({
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Darker rims where the wash changes.',
    }),
    granulation: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Pigment settling into the paper grain.',
    }),
    paper: color({
      theme: 'background',
      default: '#fbf7ee',
      description: 'Paper color, which shows through thin washes.',
    }),
    seed: seed(),
  },
  presets: {
    wet: { bleed: 10, wobble: 6, edgeDarkening: 0.9 },
    dry: { bleed: 2, granulation: 1 },
    sketchbook: { paper: '#f1e8d6', wobble: 8 },
    gentle: { edgeDarkening: 0.3, granulation: 0.3 },
  },
  fragment,
});
