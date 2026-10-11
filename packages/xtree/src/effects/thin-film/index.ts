import {
  defineMaterialEffect,
  float,
  seed,
  select,
} from '../../effect/index.js';
import { colorSpectralChunks, noiseSimplexChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** Soap-bubble and oil-slick iridescence from thin-film interference. */
export const thinFilm = defineMaterialEffect({
  name: 'thin-film',
  meta: {
    title: 'Thin-film iridescence',
    family: 'holographic',
    story: 'X11.2',
    description:
      'Soap-bubble and oil-slick colors from thin-film interference: a film whose thickness varies across the surface reflects different wavelengths, and the colors slide as the viewing angle changes. Works on any lit or unlit material.',
    related: ['foil-material', 'holographic-foil', 'fresnel-glow'],
    demo: { selection: ['knot'] },
  },
  motion: 'freeze',
  chunks: [colorSpectralChunks, noiseSimplexChunks],
  params: {
    thicknessMin: float({
      default: 250,
      min: 0,
      max: 1500,
      step: 5,
      unit: 'nm',
      description: 'Thinnest film.',
    }),
    thicknessMax: float({
      default: 650,
      min: 0,
      max: 1500,
      step: 5,
      unit: 'nm',
      description: 'Thickest film.',
    }),
    ior: float({
      default: 1.33,
      min: 1,
      max: 2.5,
      step: 0.01,
      description: 'Refractive index of the film (soap water 1.33, oil 1.47).',
    }),
    variation: select({
      options: ['noise', 'height', 'uniform'],
      default: 'noise',
      structural: true,
      description:
        'How thickness varies: swirling noise, bands up the object like a draining bubble, or one thickness.',
    }),
    scale: float({
      default: 1.5,
      min: 0.1,
      max: 10,
      step: 0.05,
      description: 'Size of the thickness swirls or bands.',
    }),
    intensity: float({
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much the film tints the surface.',
    }),
    sheen: float({
      default: 0.6,
      min: 0,
      max: 3,
      step: 0.01,
      description: 'Film reflection added on top, strongest at grazing angles.',
    }),
    speed: float({
      default: 0.15,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'How fast the film swirls (stops when motion is off).',
    }),
    seed: seed(),
  },
  presets: {
    soapBubble: {
      thicknessMin: 150,
      thicknessMax: 900,
      intensity: 0.9,
      sheen: 1.2,
    },
    oilSlick: {
      ior: 1.47,
      thicknessMin: 300,
      thicknessMax: 800,
      scale: 3,
      intensity: 0.7,
    },
    beetle: {
      variation: 'uniform',
      thicknessMin: 420,
      ior: 1.56,
      intensity: 1,
      sheen: 0.4,
    },
    draining: {
      variation: 'height',
      thicknessMin: 100,
      thicknessMax: 1100,
      scale: 2,
    },
  },
  fragment,
});
