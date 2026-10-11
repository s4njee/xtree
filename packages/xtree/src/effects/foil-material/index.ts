import {
  color,
  defineMaterialEffect,
  float,
  select,
} from '../../effect/index.js';
import {
  colorLuminanceChunks,
  colorSpaceChunks,
  noiseHashChunks,
  noiseSimplexChunks,
} from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** The holographic foil on a surface: the rainbow follows the real viewing angle of each point. */
export const foilMaterial = defineMaterialEffect({
  name: 'foil-material',
  meta: {
    title: 'Holographic foil material',
    family: 'holographic',
    story: 'X11.1',
    description:
      'The holographic foil as a material: the rainbow and glints follow the true viewing angle at each point of the surface, so a card, sticker or logo shimmers as it or the camera moves, with no pointer input needed.',
    related: ['holographic-foil', 'thin-film', 'fresnel-glow'],
    demo: { selection: ['box', 'knot'] },
  },
  motion: 'freeze',
  chunks: [
    colorSpaceChunks,
    colorLuminanceChunks,
    noiseHashChunks,
    noiseSimplexChunks,
  ],
  params: {
    intensity: float({
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How strongly the foil tints the surface.',
    }),
    sheen: float({
      default: 0.35,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'Foil light added on top, strongest on lit areas.',
    }),
    pattern: select({
      options: ['linear', 'radial', 'cosmos'],
      default: 'linear',
      description:
        'Rainbow layout across the surface: straight bands, rings, or bands warped by noise.',
    }),
    scale: float({
      default: 1.5,
      min: 0.1,
      max: 10,
      step: 0.05,
      description: 'Rainbow repeats per unit of surface (UV or object space).',
    }),
    angleResponse: float({
      default: 1.5,
      min: 0,
      max: 5,
      step: 0.05,
      description: 'How far the colors slide as the viewing angle changes.',
    }),
    saturation: float({
      default: 0.75,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Color saturation of the foil.',
    }),
    sparkle: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Density of view-dependent glints.',
    }),
    speed: float({
      default: 0.2,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'Drift of the cosmos pattern (stops when motion is off).',
    }),
    tint: color({
      default: '#ffffff',
      description: 'Color multiplied into the foil.',
    }),
  },
  presets: {
    card: { intensity: 0.8, sheen: 0.5, sparkle: 0.6 },
    sticker: { pattern: 'radial', scale: 3, sparkle: 0.2 },
    cosmos: { pattern: 'cosmos', scale: 2, intensity: 0.9, sheen: 0.6 },
    subtle: { intensity: 0.35, sheen: 0.15, sparkle: 0.1 },
  },
  fragment,
});
