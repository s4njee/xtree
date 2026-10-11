import { defineEffect, float, select, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Concentric water ripples or a repeating shockwave ring, spreading from a point. */
export const ripple = defineEffect({
  name: 'ripple',
  meta: {
    title: 'Ripple',
    family: 'distortion',
    story: 'X9.1',
    description:
      'Concentric water ripples, or a shockwave ring that expands and fades, spreading from a point. The waves bend the image radially and can catch the light.',
    related: ['displacement-map', 'lens-distortion'],
  },
  sampling: 'input',
  motion: 'freeze',
  params: {
    mode: select({
      options: ['ripple', 'shockwave'],
      default: 'ripple',
      description: 'Continuous waves, or one ring that repeats.',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Origin of the waves, in UV coordinates.',
    }),
    amplitude: float({
      default: 0.02,
      min: 0,
      max: 0.1,
      step: 0.001,
      description: 'Largest displacement, as a fraction of the height.',
    }),
    wavelength: float({
      default: 0.08,
      min: 0.01,
      max: 0.5,
      step: 0.005,
      description:
        'Distance between crests, or the width of the shockwave ring, as a fraction of the height.',
    }),
    speed: float({
      default: 0.15,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'How fast the waves travel outwards, in heights per second.',
    }),
    decay: float({
      default: 1.5,
      min: 0,
      max: 10,
      step: 0.1,
      description:
        'How quickly the waves weaken with distance (ripple) or as the ring grows (shockwave).',
    }),
    interval: float({
      default: 2,
      min: 0.25,
      max: 10,
      step: 0.05,
      unit: 's',
      description: 'Shockwave: time between rings.',
    }),
    phase: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Shockwave: how far through its cycle the ring is at time zero; with motion off this fixes where the ring sits.',
    }),
    shading: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Brightens the wave faces that tilt toward the viewer.',
    }),
  },
  presets: {
    pond: { amplitude: 0.01, wavelength: 0.05, decay: 3 },
    swell: { amplitude: 0.025, wavelength: 0.2, speed: 0.08, decay: 1 },
    shockwave: {
      mode: 'shockwave',
      amplitude: 0.06,
      wavelength: 0.08,
      speed: 0.6,
      decay: 1,
      interval: 1.6,
      shading: 0.6,
    },
    pulse: {
      mode: 'shockwave',
      amplitude: 0.015,
      wavelength: 0.12,
      speed: 0.3,
      interval: 3,
      shading: 0.6,
    },
  },
  fragment,
});
