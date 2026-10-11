import { defineEffect, float } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Exposure in photographic stops, a black-level offset and a gamma curve, in linear light. */
export const exposureGamma = defineEffect({
  name: 'exposure-gamma',
  meta: {
    title: 'Exposure & gamma',
    family: 'color',
    story: 'X3.3',
    description:
      'Exposure in photographic stops, a black-level offset and a gamma curve, applied in linear light before tone mapping, like adjusting a camera rather than a screenshot.',
    related: ['brightness-contrast', 'bloom'],
  },
  params: {
    exposure: float({
      default: 0,
      min: -5,
      max: 5,
      step: 0.05,
      unit: 'EV',
      description: 'Each stop doubles (or halves) the light.',
    }),
    gamma: float({
      default: 1,
      min: 0.2,
      max: 5,
      step: 0.01,
      description: 'Above 1 lifts the midtones; below 1 deepens them.',
    }),
    offset: float({
      default: 0,
      min: -0.2,
      max: 0.2,
      step: 0.001,
      description: 'Added in linear light: raises or crushes the blacks.',
    }),
  },
  presets: {
    brighter: { exposure: 1 },
    darker: { exposure: -1 },
    lifted: { gamma: 1.4 },
    crushed: { gamma: 0.75, offset: -0.01 },
  },
  fragment,
});
