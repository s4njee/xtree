import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Sine-wave warp, like a flag or a reflection in water. */
export const waveWarp = defineEffect({
  name: 'wave-warp',
  meta: {
    title: 'Wave warp',
    family: 'distortion',
    story: 'X9.4',
    description:
      'Bends the image along travelling sine waves, horizontally, vertically or both, like a flag in the wind or a reflection in water.',
    related: ['ripple', 'heat-haze', 'twirl'],
  },
  sampling: 'input',
  motion: 'freeze',
  params: {
    axis: select({
      options: ['horizontal', 'vertical', 'both'],
      default: 'horizontal',
      description: 'Which way the image is pushed.',
    }),
    amplitude: float({
      default: 10,
      min: 0,
      max: 80,
      step: 0.5,
      unit: 'px',
      description: 'Height of the waves.',
    }),
    frequency: float({
      default: 4,
      min: 0.5,
      max: 40,
      step: 0.5,
      description: 'Waves across the frame height.',
    }),
    speed: float({
      default: 0.5,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Waves per second passing a point.',
    }),
  },
  presets: {
    flag: { axis: 'vertical', amplitude: 14, frequency: 2, speed: 0.6 },
    underwater: { axis: 'both', amplitude: 6, frequency: 6, speed: 0.4 },
    jelly: { axis: 'both', amplitude: 24, frequency: 1.5, speed: 0.3 },
    interference: { amplitude: 3, frequency: 30, speed: 0 },
  },
  fragment,
});
