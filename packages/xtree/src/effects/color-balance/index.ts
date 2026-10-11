import { bool, defineEffect, float, vec3 } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Lift, gamma and gain: the shadow, midtone and highlight wheels of a color grading tool. */
export const colorBalance = defineEffect({
  name: 'color-balance',
  meta: {
    title: 'Color balance (lift, gamma, gain)',
    family: 'color',
    story: 'X3.12',
    description:
      'The three wheels of a grading tool: lift tints the shadows, gamma the midtones and gain the highlights, per channel.',
    related: ['split-toning', 'curves', 'white-balance'],
  },
  chunks: [colorSpaceChunks],
  params: {
    lift: vec3({
      default: [0, 0, 0],
      min: -0.5,
      max: 0.5,
      step: 0.005,
      description:
        'Added to the shadows, fading out toward white (red, green, blue).',
    }),
    gamma: vec3({
      default: [1, 1, 1],
      min: 0.3,
      max: 3,
      step: 0.01,
      description: 'Midtone gamma per channel; above 1 brightens.',
    }),
    gain: vec3({
      default: [1, 1, 1],
      min: 0,
      max: 2,
      step: 0.01,
      description: 'Multiplies the highlights per channel.',
    }),
    preserveLuminance: bool({
      default: false,
      description:
        'Keep each pixel’s brightness, so the wheels only shift color.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the graded image.',
    }),
  },
  presets: {
    tealOrange: {
      lift: [-0.02, 0.02, 0.05],
      gain: [1.08, 1, 0.9],
      preserveLuminance: true,
    },
    warmHighlights: { gain: [1.1, 1.03, 0.92] },
    coolShadows: { lift: [-0.03, 0.01, 0.06] },
    filmic: {
      lift: [0.03, 0.03, 0.04],
      gamma: [0.95, 0.97, 1],
      gain: [0.97, 0.97, 0.95],
    },
  },
  fragment,
});
