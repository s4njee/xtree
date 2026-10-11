import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Darkened lines across the frame, like a CRT or an interlaced display. */
export const scanlines = defineEffect({
  name: 'scanlines',
  meta: {
    title: 'Scanlines',
    family: 'retro',
    story: 'X7.3',
    description:
      'Darkened horizontal or vertical lines across the frame, hard or soft, optionally scrolling slowly. Scrolling stops when motion is off.',
    related: ['crt', 'scanline-tear', 'dither'],
  },
  motion: 'freeze',
  params: {
    lineWidth: float({
      default: 3,
      min: 1,
      max: 16,
      step: 0.5,
      unit: 'px',
      description: 'Period of the lines.',
    }),
    intensity: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How dark the lines are.',
    }),
    softness: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Hard-edged (0) to sinusoidal (1) lines.',
    }),
    speed: float({
      default: 0,
      min: -60,
      max: 60,
      step: 1,
      unit: 'px/s',
      description: 'Scroll speed.',
    }),
    orientation: select({
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Line direction.',
    }),
  },
  presets: {
    subtle: { intensity: 0.18 },
    arcade: { lineWidth: 4, intensity: 0.5, softness: 0.3 },
    rolling: { speed: 12, intensity: 0.3 },
    vertical: { orientation: 'vertical', lineWidth: 3, intensity: 0.3 },
  },
  fragment,
});
