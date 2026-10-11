import { defineEffect, float, int, vec2 } from '../../effect/index.js';
import { colorSpectralChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Spectral dispersion: edges split into a rainbow, as through a prism. */
export const prism = defineEffect({
  name: 'prism',
  meta: {
    title: 'Prism dispersion',
    family: 'holographic',
    story: 'X11.4',
    description:
      'Splits the image into a full spectrum fanning out from a center, so edges grow rainbow fringes like light through a prism or a cheap lens.',
    related: ['chromatic-aberration', 'holographic-foil', 'thin-film'],
  },
  sampling: 'input',
  chunks: [colorSpectralChunks],
  params: {
    spread: float({
      default: 0.02,
      min: 0,
      max: 0.1,
      step: 0.001,
      description:
        'Width of the spectrum at the edge of the frame, as a fraction of it.',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Where dispersion is zero.',
    }),
    falloff: float({
      default: 1.5,
      min: 0.5,
      max: 4,
      step: 0.05,
      description: 'How quickly the spread grows toward the edges.',
    }),
    samples: int({
      default: 12,
      min: 3,
      max: 24,
      step: 1,
      description: 'Wavelengths sampled; more give smoother rainbows.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the dispersed image.',
    }),
  },
  presets: {
    rainbow: { spread: 0.05, samples: 20 },
    subtle: { spread: 0.008 },
    edges: { falloff: 3, spread: 0.06 },
    crystal: { spread: 0.035, falloff: 1, samples: 16 },
  },
  fragment,
});
