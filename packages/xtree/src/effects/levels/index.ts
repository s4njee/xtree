import { defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Photo-editor levels: black, white and gamma in, black and white out. */
export const levels = defineEffect({
  name: 'levels',
  meta: {
    title: 'Levels',
    family: 'color',
    story: 'X3.9',
    description:
      'Photo-editor levels: stretch the tones between an input black and white point, bend the midtones with gamma, and remap to an output range, for all channels or one.',
    related: ['curves', 'exposure-gamma', 'brightness-contrast'],
  },
  chunks: [colorSpaceChunks],
  params: {
    inputBlack: float({
      default: 0,
      min: 0,
      max: 0.9,
      step: 0.005,
      description: 'Input value that becomes black; darker values clip.',
    }),
    inputWhite: float({
      default: 1,
      min: 0.1,
      max: 1,
      step: 0.005,
      description:
        'Input value that becomes white; brighter values stay brighter.',
    }),
    gamma: float({
      default: 1,
      min: 0.2,
      max: 4,
      step: 0.01,
      description:
        'Midtone gamma: above 1 brightens the midtones, below 1 darkens them.',
    }),
    outputBlack: float({
      default: 0,
      min: 0,
      max: 0.9,
      step: 0.005,
      description: 'Output value for black; raise it for a faded, matte look.',
    }),
    outputWhite: float({
      default: 1,
      min: 0.1,
      max: 1,
      step: 0.005,
      description: 'Output value for white.',
    }),
    channel: select({
      options: ['rgb', 'red', 'green', 'blue'],
      optionLabels: { rgb: 'RGB' },
      default: 'rgb',
      structural: true,
      description: 'Adjust every channel together, or only one.',
    }),
  },
  presets: {
    contrast: { inputBlack: 0.06, inputWhite: 0.94 },
    matte: { outputBlack: 0.08, outputWhite: 0.95 },
    brighten: { gamma: 1.4 },
    crush: { inputBlack: 0.15, gamma: 0.85 },
  },
  fragment,
});
