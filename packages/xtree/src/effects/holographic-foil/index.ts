import {
  color,
  defineEffect,
  float,
  select,
  vec2,
} from '../../effect/index.js';
import {
  colorLuminanceChunks,
  colorSpaceChunks,
  noiseHashChunks,
  noiseSimplexChunks,
} from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** An iridescent rainbow overlay, like a holographic trading card, that shifts with tilt. */
export const holographicFoil = defineEffect({
  name: 'holographic-foil',
  meta: {
    title: 'Holographic foil',
    family: 'holographic',
    story: 'X11.1',
    description:
      'An iridescent rainbow sheen, like a holographic trading card. Drive `tilt` from the pointer or device orientation to make the colors slide as the card moves; glitter adds view-dependent glints.',
    related: ['bloom', 'chromatic-aberration'],
  },
  motion: 'freeze',
  chunks: [
    colorSpaceChunks,
    colorLuminanceChunks,
    noiseSimplexChunks,
    noiseHashChunks,
  ],
  params: {
    intensity: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the iridescent tint on lit surfaces.',
    }),
    sheen: float({
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Foil light added on top of bright areas.',
    }),
    pattern: select({
      options: ['linear', 'radial', 'cosmos'],
      default: 'cosmos',
      description: 'Shape of the rainbow bands.',
    }),
    tilt: vec2({
      default: [0, 0],
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Viewing angle, for example the pointer position. Moves the bands and glints.',
    }),
    angle: float({
      default: 35,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Direction of the bands (linear and cosmos patterns).',
    }),
    scale: float({
      default: 1.6,
      min: 0.1,
      max: 8,
      step: 0.05,
      description: 'Number of rainbow cycles across the frame.',
    }),
    hueShift: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      unit: 'turns',
      description: 'Rotates the rainbow.',
    }),
    saturation: float({
      default: 0.65,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Color purity of the foil.',
    }),
    luminanceMask: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much the foil favors bright areas, as printed foil does.',
    }),
    sparkle: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Density of view-dependent glitter.',
    }),
    speed: float({
      default: 0.5,
      min: 0,
      max: 4,
      step: 0.05,
      description:
        'Drift of the pattern over time. Freezes when motion is off.',
    }),
    tint: color({
      default: '#ffffff',
      description: 'Color multiplied into the foil.',
    }),
  },
  presets: {
    card: { pattern: 'cosmos', intensity: 0.75, sheen: 0.25, sparkle: 0.5 },
    prism: {
      pattern: 'linear',
      scale: 3,
      saturation: 0.9,
      sparkle: 0,
      sheen: 0.3,
      luminanceMask: 0.2,
    },
    halo: { pattern: 'radial', scale: 4, intensity: 0.6, sparkle: 0.2 },
    pearl: {
      saturation: 0.25,
      intensity: 0.6,
      sheen: 0.2,
      sparkle: 0.1,
      tint: '#f3e8ff',
    },
  },
  fragment,
});
