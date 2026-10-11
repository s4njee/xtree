import {
  defineEffect,
  float,
  select,
  texture,
  vec2,
} from '../../effect/index.js';
import { noiseSimplexChunks } from '../../shaders/maps.js';
import { mapSize, noiseMapTexels, wavesMapTexels } from './maps.js';
import fragment from './shader.glsl';

export { noiseMapTexels, wavesMapTexels } from './maps.js';

/** Offsets the image by the values of a texture: red and green, or brightness along an angle. */
export const displacementMap = defineEffect({
  name: 'displacement-map',
  meta: {
    title: 'Displacement map',
    family: 'distortion',
    story: 'X9.2',
    description:
      'Offsets the image by the values of a texture, scaled and scrolling: red and green move pixels sideways and up, or brightness moves them along an angle. Without a map it uses animated simplex noise.',
    related: ['ripple', 'lens-distortion', 'block-displacement'],
  },
  sampling: 'input',
  motion: 'freeze',
  chunks: [noiseSimplexChunks],
  params: {
    map: texture({
      dimension: '2d',
      default: 'noise',
      description:
        'Displacement texture, centered on 0.5 (mid-gray moves nothing). With no map, procedural simplex noise is used.',
      samples: {
        noise: () => ({
          kind: 'data2d',
          width: mapSize,
          height: mapSize,
          data: noiseMapTexels(),
          filter: 'linear',
          wrap: 'repeat',
        }),
        waves: () => ({
          kind: 'data2d',
          width: mapSize,
          height: mapSize,
          data: wavesMapTexels(),
          filter: 'linear',
          wrap: 'repeat',
        }),
      },
    }),
    strength: float({
      default: 0.03,
      min: 0,
      max: 0.25,
      step: 0.001,
      description: 'Largest offset, as a fraction of the height.',
    }),
    scale: float({
      default: 1,
      min: 0.1,
      max: 8,
      step: 0.05,
      description: 'Map repeats across the height of the image.',
    }),
    scroll: vec2({
      default: [0.02, 0.01],
      min: -1,
      max: 1,
      step: 0.005,
      description: 'Map movement per second, in map widths.',
    }),
    channel: select({
      options: ['rg', 'luminance'],
      default: 'rg',
      description:
        'Red and green move pixels horizontally and vertically, or brightness moves them along the angle.',
      optionLabels: { rg: 'Red/green' },
    }),
    angle: float({
      default: 45,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Luminance: direction of the offset.',
    }),
  },
  presets: {
    heatHaze: { map: 'noise', strength: 0.008, scale: 3, scroll: [0, 0.12] },
    glass: { map: 'waves', strength: 0.02, scale: 1.5, scroll: [0, 0] },
    liquid: { map: null, strength: 0.05, scale: 2, scroll: [0.05, 0.03] },
    smear: {
      map: 'noise',
      channel: 'luminance',
      strength: 0.06,
      angle: 0,
      scale: 0.6,
    },
  },
  fragment,
});
