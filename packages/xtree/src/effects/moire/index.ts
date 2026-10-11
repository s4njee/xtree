import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Interference bands from two overlapping fine patterns. */
export const moire = defineEffect({
  name: 'moire',
  meta: {
    title: 'Moiré interference',
    family: 'holographic',
    story: 'X11.6',
    description:
      'Overlays two fine line or ring patterns at a slight angle, so they interfere into the large, shifting bands of moiré, as in security holograms and layered screens.',
    related: ['holographic-foil', 'halftone', 'scanlines'],
  },
  motion: 'freeze',
  params: {
    pattern: select({
      options: ['lines', 'rings'],
      default: 'lines',
      structural: true,
      description: 'Straight lines or concentric rings.',
    }),
    frequency: float({
      default: 80,
      min: 10,
      max: 300,
      step: 1,
      description: 'Lines per frame height.',
    }),
    angle: float({
      default: 30,
      min: 0,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Angle of the first pattern.',
    }),
    twist: float({
      default: 3,
      min: 0,
      max: 30,
      step: 0.1,
      unit: '°',
      description:
        'Angle between the two patterns; small angles make wide bands.',
    }),
    scale: float({
      default: 0.02,
      min: 0,
      max: 0.2,
      step: 0.001,
      description: 'Difference in spacing between the patterns.',
    }),
    offset: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Shift of the second pattern.',
    }),
    speed: float({
      default: 0.5,
      min: 0,
      max: 3,
      step: 0.05,
      description: 'Drift of the second pattern, which moves the bands.',
    }),
    iridescence: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Rainbow tint in the bands.',
    }),
    amount: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the pattern over the image.',
    }),
  },
  presets: {
    security: { frequency: 160, twist: 1.5, iridescence: 0.8, amount: 0.4 },
    rings: { pattern: 'rings', frequency: 60, scale: 0.04 },
    silk: { frequency: 200, twist: 0.8, amount: 0.3, iridescence: 0 },
    screen: { frequency: 40, twist: 5, amount: 0.7 },
  },
  fragment,
});
