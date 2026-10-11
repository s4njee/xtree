import { bool, defineMaterialEffect, float } from '../../effect/index.js';
import { colorSpectralChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** A rainbow rim around a surface's silhouette. */
export const chromaticRim = defineMaterialEffect({
  name: 'chromatic-rim',
  meta: {
    title: 'Chromatic fresnel rim',
    family: 'material',
    story: 'X11.8',
    description:
      'Lights the rim of a surface in a full spectrum, violet to red across its width, like dispersive glass or a soap film at grazing angles.',
    related: ['fresnel-glow', 'thin-film', 'prism'],
    demo: { selection: ['knot'] },
  },
  chunks: [colorSpectralChunks],
  params: {
    intensity: float({
      default: 1.5,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Brightness of the rim (HDR above 1).',
    }),
    power: float({
      default: 2,
      min: 0.5,
      max: 8,
      step: 0.1,
      description: 'How tightly the rim hugs the silhouette.',
    }),
    width: float({
      default: 0.6,
      min: 0.1,
      max: 1,
      step: 0.01,
      description: 'How far in from the silhouette the spectrum spreads.',
    }),
    reverse: bool({
      default: false,
      description: 'Red on the inside and violet at the silhouette.',
    }),
  },
  presets: {
    soapFilm: { intensity: 1, power: 1.5, width: 0.9 },
    crystal: { intensity: 2.5, power: 3, width: 0.4 },
    neon: { intensity: 4, power: 2.5 },
    reversed: { reverse: true },
  },
  fragment,
});
