import { defineEffect, float, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Mirrored wedges around a center, like a kaleidoscope. */
export const kaleidoscope = defineEffect({
  name: 'kaleidoscope',
  meta: {
    title: 'Kaleidoscope',
    family: 'distortion',
    story: 'X9.6',
    description:
      'Folds the frame into mirrored wedges around a point, like looking through a kaleidoscope.',
    related: ['mirror', 'twirl', 'holographic-foil'],
  },
  sampling: 'input',
  params: {
    segments: float({
      default: 6,
      min: 2,
      max: 24,
      step: 1,
      description: 'Number of wedges.',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Center of the kaleidoscope.',
    }),
    rotation: float({
      default: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Rotation of the wedges.',
    }),
    offset: float({
      default: 30,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Which part of the image each wedge shows.',
    }),
    zoom: float({
      default: 1,
      min: 0.25,
      max: 3,
      step: 0.01,
      description: 'Zooms the image inside the wedges.',
    }),
  },
  presets: {
    snowflake: { segments: 12, zoom: 0.8 },
    mandala: { segments: 16, zoom: 1.4, offset: 90 },
    twofold: { segments: 2 },
    tunnel: { segments: 8, zoom: 2.5 },
  },
  fragment,
});
