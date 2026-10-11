import { defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks, noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Video static: per-pixel noise with occasional stronger bands. */
export const digitalNoise = defineEffect({
  name: 'digital-noise',
  meta: {
    title: 'Digital noise',
    family: 'glitch',
    story: 'X6.4',
    description:
      'Video static: mono or color noise that changes every frame, with occasional stronger horizontal bands. With motion off the static holds still.',
    related: ['film-grain', 'scanline-tear', 'block-displacement'],
  },
  motion: 'freeze',
  chunks: [colorSpaceChunks, noiseHashChunks],
  params: {
    amount: float({
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the static.',
    }),
    mode: select({
      options: ['mono', 'color'],
      default: 'mono',
      description: 'Grey static, or independent noise per channel.',
    }),
    size: float({
      default: 1,
      min: 1,
      max: 8,
      step: 0.5,
      unit: 'px',
      description: 'Size of a noise cell.',
    }),
    rate: float({
      default: 30,
      min: 1,
      max: 60,
      step: 1,
      unit: 'fps',
      description: 'How often the static changes.',
    }),
    bands: float({
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How often stronger noise bands appear.',
    }),
  },
  presets: {
    light: { amount: 0.08, bands: 0.1 },
    tv: { amount: 0.35, size: 1.5, bands: 0.4 },
    color: { mode: 'color', amount: 0.2 },
    coarse: { amount: 0.25, size: 4, rate: 12 },
  },
  fragment,
});
