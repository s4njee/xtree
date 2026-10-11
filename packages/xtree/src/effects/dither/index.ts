import {
  bool,
  defineEffect,
  float,
  int,
  select,
  texture,
} from '../../effect/index.js';
import {
  colorSpaceChunks,
  ditherOrderedChunks,
  noiseBlueChunks,
} from '../../shaders/maps.js';
import { blueNoiseTexels } from './blue-noise.js';
import fragment from './shader.glsl';

export { blueNoiseTexels, voidAndCluster } from './blue-noise.js';

/** Reduces each channel to a few levels with ordered (Bayer), blue-noise or interleaved-gradient dithering. */
export const dither = defineEffect({
  name: 'dither',
  meta: {
    title: 'Dither',
    family: 'retro',
    story: 'X7.2',
    description:
      'Reduces each channel to a few levels and hides the banding with a dither pattern: ordered Bayer matrices, void-and-cluster blue noise, or interleaved gradient noise.',
    related: ['pixelate', 'halftone', 'scanlines'],
  },
  chunks: [colorSpaceChunks, noiseBlueChunks, ditherOrderedChunks],
  params: {
    pattern: select({
      options: ['bayer2', 'bayer4', 'bayer8', 'blueNoise', 'noise'],
      default: 'bayer4',
      description:
        'Threshold pattern: Bayer matrices give a regular cross-hatch, blue noise an even grain, noise a cheap texture-free grain.',
      optionLabels: {
        bayer2: 'Bayer 2',
        bayer4: 'Bayer 4',
        bayer8: 'Bayer 8',
        blueNoise: 'Blue noise',
        noise: 'IGN',
      },
    }),
    levels: int({
      default: 4,
      min: 2,
      max: 32,
      step: 1,
      description: 'Values per channel after quantizing.',
    }),
    scale: float({
      default: 2,
      min: 1,
      max: 8,
      step: 1,
      unit: 'px',
      description: 'Size of a dither cell.',
    }),
    grayscale: bool({
      default: false,
      description: 'Dither brightness only, for a one-color look.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the dithered image.',
    }),
    noise: texture({
      dimension: '2d',
      default: 'blueNoise64',
      description: 'Blue-noise threshold map used by the blue-noise pattern.',
      samples: {
        blueNoise64: () => ({
          kind: 'data2d',
          width: 64,
          height: 64,
          data: blueNoiseTexels(),
          filter: 'nearest',
          wrap: 'repeat',
        }),
      },
    }),
  },
  presets: {
    gameboy: { pattern: 'bayer4', levels: 4, grayscale: true, scale: 3 },
    blueNoise: { pattern: 'blueNoise', levels: 3, scale: 2 },
    fine: { pattern: 'bayer8', levels: 6, scale: 1 },
    oneBit: { pattern: 'blueNoise', levels: 2, grayscale: true, scale: 2 },
  },
  fragment,
});
