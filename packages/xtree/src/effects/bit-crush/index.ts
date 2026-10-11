import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks, ditherOrderedChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Fewer bits per color channel, like an old frame buffer. */
export const bitCrush = defineEffect({
  name: 'bit-crush',
  meta: {
    title: 'Bit crush',
    family: 'glitch',
    story: 'X6.8',
    description:
      'Throws away color depth (and optionally resolution), like a frame buffer with too few bits: smooth gradients turn into bands.',
    related: ['dither', 'palette', 'pixelate'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks, ditherOrderedChunks],
  params: {
    bits: float({
      default: 3,
      min: 1,
      max: 8,
      step: 1,
      description:
        'Bits per channel: 1 gives 2 levels, 3 gives 8, 8 is unchanged.',
    }),
    dither: bool({
      default: false,
      description: 'Ordered dithering, which trades bands for a fine pattern.',
    }),
    downsample: float({
      default: 1,
      min: 1,
      max: 16,
      step: 1,
      unit: 'px',
      description: 'Size of each sample, for a lower resolution as well.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the crushed image.',
    }),
  },
  presets: {
    eightBit: { bits: 2, dither: true },
    harsh: { bits: 1, downsample: 2 },
    lofi: { bits: 3, downsample: 3 },
    banding: { bits: 4 },
  },
  fragment,
});
