import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Hue rotation, saturation and lightness, or a single-hue colorize, in the perceptual OKLCH space. */
export const hueSaturation = defineEffect({
  name: 'hue-saturation',
  meta: {
    title: 'Hue / saturation',
    family: 'color',
    story: 'X3.2',
    description:
      'Rotates hues, scales saturation and lifts or lowers lightness in OKLCH, a perceptual space, so a hue shift does not make yellows glow or blues go dark. Colorize paints everything one hue.',
    related: ['brightness-contrast', 'monochrome', 'gradient-map'],
  },
  chunks: [colorSpaceChunks],
  params: {
    hue: float({
      default: 0,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Rotates every hue.',
    }),
    saturation: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Scales chroma; −1 removes color.',
    }),
    lightness: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Moves lightness toward black (negative) or white (positive).',
    }),
    colorize: bool({
      default: false,
      description: 'Replace every hue with one color, keeping lightness.',
    }),
    colorizeHue: float({
      default: 220,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Colorize: the hue to use.',
    }),
    colorizeChroma: float({
      default: 0.08,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: 'Colorize: the chroma (colorfulness) to use.',
    }),
  },
  presets: {
    shifted: { hue: 45 },
    desaturated: { saturation: -0.7 },
    cyanotype: { colorize: true, colorizeHue: 235, colorizeChroma: 0.1 },
    rose: {
      colorize: true,
      colorizeHue: 350,
      colorizeChroma: 0.07,
      lightness: 0.05,
    },
  },
  fragment,
});
