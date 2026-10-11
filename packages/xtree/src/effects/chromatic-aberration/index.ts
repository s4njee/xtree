import { defineEffect, float, int, select, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Splits color channels apart, like a lens that focuses each wavelength differently. */
export const chromaticAberration = defineEffect({
  name: 'chromatic-aberration',
  meta: {
    title: 'Chromatic aberration',
    family: 'lens',
    story: 'X4.1',
    description:
      'Shifts red and blue (or a whole spectrum) apart, like a lens that focuses each wavelength at a slightly different place.',
    related: ['rgb-split-glitch', 'vignette'],
  },
  sampling: 'input',
  params: {
    offset: float({
      default: 0.004,
      min: 0,
      max: 0.05,
      step: 0.0005,
      description:
        'Channel separation at the frame edge, as a fraction of the frame height.',
    }),
    mode: select({
      options: ['radial', 'directional'],
      default: 'radial',
      description:
        'Radial grows from the center like a real lens; directional shifts everything the same way.',
    }),
    falloff: float({
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      description:
        'Radial mode: how quickly the separation grows toward the edges (0 is uniform).',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Radial mode: the optical center in UV coordinates.',
    }),
    direction: vec2({
      default: [1, 0],
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Directional mode: the shift direction.',
    }),
    samples: int({
      default: 3,
      min: 3,
      max: 16,
      step: 1,
      structural: true,
      description:
        '3 shifts red and blue only; more samples blend a smooth spectrum (and cost one texture read each).',
    }),
  },
  presets: {
    subtle: { offset: 0.002 },
    lens: { offset: 0.008, falloff: 1.6, samples: 8 },
    prism: { offset: 0.02, falloff: 1.2, samples: 12 },
    shifted: { mode: 'directional', offset: 0.006, direction: [1, 0.25] },
  },
  fragment,
});
