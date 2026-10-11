import { defineEffect, float } from '../../effect/index.js';
import { colorWhiteBalanceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Camera-style white balance by color temperature and tint. */
export const whiteBalance = defineEffect({
  name: 'white-balance',
  meta: {
    title: 'White balance',
    family: 'color',
    story: 'X3.11',
    description:
      'Camera-style white balance: tell it the color temperature of the light and it neutralizes it (a Bradford adaptation in linear light), with a green–magenta tint.',
    related: ['color-balance', 'split-toning', 'exposure-gamma'],
  },
  chunks: [colorWhiteBalanceChunks],
  params: {
    temperature: float({
      default: 6500,
      min: 2000,
      max: 12000,
      step: 50,
      unit: 'K',
      description:
        'The light the image is corrected for: lower values cool the image, higher values warm it. 6500 K leaves it unchanged.',
    }),
    tint: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Positive is more magenta, negative more green.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the balanced image.',
    }),
  },
  presets: {
    tungsten: { temperature: 3200 },
    daylight: { temperature: 5500 },
    cloudy: { temperature: 7500 },
    shade: { temperature: 9000, tint: 0.1 },
  },
  fragment,
});
