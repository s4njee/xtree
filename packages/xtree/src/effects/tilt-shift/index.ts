import { defineEffect, float, int } from '../../effect/index.js';
import fragment from './shader.glsl';

/** The miniature look: everything outside a focus band blurs away. */
export const tiltShift = defineEffect({
  name: 'tilt-shift',
  meta: {
    title: 'Tilt-shift',
    family: 'lens',
    story: 'X4.5',
    description:
      'The miniature-model look of a tilted lens: a sharp band of focus, with blur growing smoothly on either side.',
    related: ['blur', 'vignette'],
  },
  sampling: 'input',
  params: {
    focus: float({
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Position of the sharp band across the frame.',
    }),
    width: float({
      default: 0.18,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Width of the sharp band.',
    }),
    feather: float({
      default: 0.3,
      min: 0.01,
      max: 1,
      step: 0.01,
      description: 'Distance over which the blur ramps up.',
    }),
    angle: float({
      default: 0,
      min: 0,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Rotation of the band; 0 is horizontal.',
    }),
    blur: float({
      default: 10,
      min: 0,
      max: 40,
      step: 0.5,
      unit: 'px',
      description: 'Blur radius at full strength.',
    }),
    samples: int({
      default: 24,
      min: 8,
      max: 64,
      step: 4,
      structural: true,
      description: 'Texture reads per pixel; more is smoother and slower.',
    }),
  },
  presets: {
    miniature: { blur: 14, width: 0.12, feather: 0.25 },
    subtle: { blur: 5, width: 0.3 },
    diagonal: { angle: 30, blur: 12 },
    vertical: { angle: 90, focus: 0.5, blur: 12 },
  },
  fragment,
});
