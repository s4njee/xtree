import { color, defineMaterialEffect, float } from '../../effect/index.js';
import {
  colorLuminanceChunks,
  noiseHashChunks,
  noiseSimplexChunks,
} from '../../shaders/maps.js';
import fragment from './fragment.glsl';
import vertex from './vertex.glsl';

/** A projected hologram: see-through additive light with scanlines, a bright rim, flicker and glitches. */
export const hologram = defineMaterialEffect({
  name: 'hologram',
  meta: {
    title: 'Hologram',
    family: 'holographic',
    story: 'X11.3',
    description:
      'Turns a mesh into a projected hologram: see-through additive light with moving scanlines, a bright fresnel rim, a gentle flicker and occasional glitch slices. Flicker stays slow and shallow, and flicker, glitches and scrolling stop when motion is off.',
    related: ['fresnel-glow', 'thin-film', 'scanlines'],
    demo: { selection: ['knot'] },
  },
  motion: { settle: { flicker: 0, glitch: 0, scanlineSpeed: 0 } },
  settings: {
    transparent: true,
    depthWrite: false,
    blending: 'additive',
    doubleSided: true,
  },
  chunks: [colorLuminanceChunks, noiseHashChunks, noiseSimplexChunks],
  params: {
    color: color({ default: '#5ad8ff', description: 'Hologram color.' }),
    intensity: float({
      default: 1.2,
      min: 0,
      max: 5,
      step: 0.05,
      description: 'Brightness, in linear units.',
    }),
    shading: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much of the original lighting shows through.',
    }),
    rimPower: float({
      default: 2.5,
      min: 0.5,
      max: 8,
      step: 0.1,
      description: 'Width of the bright rim: higher hugs the silhouette.',
    }),
    rimIntensity: float({
      default: 2,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Brightness of the rim.',
    }),
    scanlineDensity: float({
      default: 40,
      min: 0,
      max: 200,
      step: 1,
      description: 'Scanlines per world unit of height; 0 turns them off.',
    }),
    scanlineStrength: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Darkness between scanlines.',
    }),
    scanlineSpeed: float({
      default: 0.3,
      min: -3,
      max: 3,
      step: 0.05,
      description: 'Scroll speed of the scanlines, in world units per second.',
    }),
    flicker: float({
      default: 0.12,
      min: 0,
      max: 0.25,
      step: 0.01,
      description:
        'Brightness wobble; slow (under 3 Hz) and at most 25%, to stay photosensitivity-safe.',
    }),
    glitch: float({
      default: 0.06,
      min: 0,
      max: 0.5,
      step: 0.005,
      description:
        'Sideways shift of occasional horizontal slices, in object units.',
    }),
  },
  presets: {
    projection: { color: '#5ad8ff', intensity: 1.4 },
    emerald: { color: '#3ddc97', scanlineDensity: 60, rimIntensity: 3 },
    damaged: { flicker: 0.25, glitch: 0.2, scanlineStrength: 0.7 },
    steady: { flicker: 0, glitch: 0, scanlineSpeed: 0, scanlineStrength: 0.3 },
  },
  vertex,
  fragment,
});
