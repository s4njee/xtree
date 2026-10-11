import { bool, defineEffect, float, vec3 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Rebuilds each color channel from a mix of the others. */
export const channelMixer = defineEffect({
  name: 'channel-mixer',
  meta: {
    title: 'Channel mixer',
    family: 'color',
    story: 'X3.13',
    description:
      'Builds each output channel from a weighted mix of the input red, green and blue: swap channels, fake infrared, or make a custom black and white.',
    related: ['monochrome', 'color-balance', 'hue-saturation'],
  },
  params: {
    red: vec3({
      default: [1, 0, 0],
      min: -2,
      max: 2,
      step: 0.01,
      description: 'How much input red, green and blue go into the output red.',
    }),
    green: vec3({
      default: [0, 1, 0],
      min: -2,
      max: 2,
      step: 0.01,
      description:
        'How much input red, green and blue go into the output green.',
    }),
    blue: vec3({
      default: [0, 0, 1],
      min: -2,
      max: 2,
      step: 0.01,
      description:
        'How much input red, green and blue go into the output blue.',
    }),
    monochrome: bool({
      default: false,
      description: 'Use the red row for every channel: a black and white mix.',
    }),
    preserveLuminance: bool({
      default: false,
      description: 'Keep each pixel’s brightness after mixing.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the remixed image.',
    }),
  },
  presets: {
    swapRedBlue: { red: [0, 0, 1], blue: [1, 0, 0] },
    infrared: {
      red: [-0.2, 1.5, -0.3],
      green: [0.2, 0.7, 0.1],
      blue: [0.9, -0.3, 0.4],
    },
    redFilterMono: { monochrome: true, red: [0.9, 0.2, -0.1] },
    vintage: {
      red: [0.9, 0.15, 0],
      green: [0.05, 0.85, 0.1],
      blue: [0.1, 0.2, 0.6],
      preserveLuminance: true,
    },
  },
  fragment,
});
