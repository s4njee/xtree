import { color, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Maps brightness onto a three-color gradient: thermal cameras, neon looks, tinted prints. */
export const gradientMap = defineEffect({
  name: 'gradient-map',
  meta: {
    title: 'Gradient map',
    family: 'color',
    story: 'X3.7',
    description:
      'Replaces every pixel with a color from a three-stop gradient chosen by its brightness, for thermal-camera, neon or tinted-print looks.',
    related: ['monochrome', 'hue-saturation', 'lut'],
  },
  chunks: [colorSpaceChunks],
  params: {
    shadows: color({
      default: '#120458',
      description: 'Color for the darkest areas.',
    }),
    midtones: color({
      default: '#ff2a6d',
      description: 'Color at the midpoint.',
    }),
    highlights: color({
      default: '#fff6c2',
      description: 'Color for the brightest areas.',
    }),
    midpoint: float({
      default: 0.5,
      min: 0.05,
      max: 0.95,
      step: 0.01,
      description: 'Brightness that maps to the midtone color.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the mapped image.',
    }),
  },
  presets: {
    thermal: {
      shadows: '#1a0b3d',
      midtones: '#e3403a',
      highlights: '#ffe66b',
      midpoint: 0.45,
    },
    cyberpunk: {
      shadows: '#120458',
      midtones: '#ff2a6d',
      highlights: '#05d9e8',
    },
    print: {
      shadows: '#2e1d12',
      midtones: '#a07856',
      highlights: '#f3e3c3',
      amount: 0.85,
    },
    ice: { shadows: '#03142e', midtones: '#3a7bd5', highlights: '#e6f7ff' },
  },
  fragment,
});
