import { defineEffect, float, seed, select } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A cathode-ray tube: curved glass, phosphor mask, scanlines, glow and vignette. */
export const crt = defineEffect({
  name: 'crt',
  meta: {
    title: 'CRT',
    family: 'retro',
    story: 'X7.4',
    description:
      'A cathode-ray tube: curved glass, an aperture-grille, slot or shadow mask, scanlines, phosphor glow, a vignette and a slight flicker. The flicker is at most ±5% brightness and stops when motion is off.',
    related: ['scanlines', 'lens-distortion', 'chromatic-aberration'],
  },
  sampling: 'input',
  motion: { settle: { flicker: 0 } },
  chunks: [noiseHashChunks],
  params: {
    curvature: float({
      default: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: 'Bulge of the glass.',
    }),
    phosphor: select({
      options: ['aperture', 'slot', 'shadow', 'none'],
      default: 'aperture',
      description:
        'Phosphor layout: vertical stripes, staggered slots or a dot triad.',
    }),
    maskStrength: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Visibility of the phosphor mask.',
    }),
    maskScale: float({
      default: 1,
      min: 1,
      max: 4,
      step: 0.5,
      unit: 'px',
      description: 'Size of a phosphor.',
    }),
    scanlines: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Darkness of the scanlines.',
    }),
    lineWidth: float({
      default: 3,
      min: 1,
      max: 12,
      step: 0.5,
      unit: 'px',
      description: 'Scanline period.',
    }),
    glow: float({
      default: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Phosphor bleed around bright pixels.',
    }),
    chromatic: float({
      default: 0.0015,
      min: 0,
      max: 0.01,
      step: 0.0005,
      description: 'Red/blue convergence error.',
    }),
    vignette: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Darkening toward the corners of the tube.',
    }),
    flicker: float({
      default: 0.02,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: 'Frame-to-frame brightness variation.',
    }),
    brightness: float({
      default: 1.15,
      min: 0.5,
      max: 2,
      step: 0.01,
      description:
        'Compensates for the light the mask and scanlines take away.',
    }),
    seed: seed(),
  },
  presets: {
    television: { curvature: 0.14, phosphor: 'shadow', maskStrength: 0.35 },
    arcade: { curvature: 0.18, phosphor: 'slot', scanlines: 0.5, glow: 0.35 },
    monitor: {
      curvature: 0.04,
      phosphor: 'aperture',
      scanlines: 0.2,
      vignette: 0.2,
    },
    flat: { curvature: 0, phosphor: 'none', scanlines: 0.4, vignette: 0 },
  },
  fragment,
});
