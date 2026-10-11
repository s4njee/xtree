import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Barrel, pincushion or mustache distortion from the Brown–Conrady lens model. */
export const lensDistortion = defineEffect({
  name: 'lens-distortion',
  meta: {
    title: 'Lens distortion',
    family: 'lens',
    story: 'X4.3',
    description:
      'Barrel, pincushion or mustache distortion from the Brown–Conrady radial lens model, with a choice of what fills the edges.',
    related: ['chromatic-aberration', 'vignette', 'crt'],
  },
  sampling: 'input',
  params: {
    k1: float({
      default: 0.15,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Main radial term: positive bulges the center outward (barrel), negative pinches it (pincushion).',
    }),
    k2: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Second radial term; opposite signs to k1 give mustache distortion.',
    }),
    scale: float({
      default: 1,
      min: 0.5,
      max: 1.5,
      step: 0.01,
      description: 'Zoom; above 1 crops the distorted edges.',
    }),
    edges: select({
      options: ['black', 'clamp', 'mirror'],
      default: 'black',
      description: 'What appears where the distortion reaches past the frame.',
    }),
  },
  presets: {
    barrel: { k1: 0.28 },
    pincushion: { k1: -0.22 },
    fisheye: { k1: 0.65, k2: 0.2, scale: 1.12 },
    mustache: { k1: 0.25, k2: -0.3, edges: 'mirror' },
  },
  fragment,
});
