import { color, defineEffect, float } from '../../effect/index.js';
import fragment from './shader.glsl';

/** A sci-fi heads-up overlay: grid lines, corner brackets and a scan sweep. */
export const hudGrid = defineEffect({
  name: 'hud-grid',
  meta: {
    title: 'HUD grid',
    family: 'holographic',
    story: 'X11.7',
    description:
      'A holographic heads-up overlay in the accent color: a fine grid with brighter major lines, corner brackets around the frame, and a slow scan sweep.',
    related: ['scanlines', 'hologram', 'outline'],
  },
  motion: { settle: { sweep: 0 } },
  params: {
    gridSize: float({
      default: 32,
      min: 8,
      max: 128,
      step: 1,
      unit: 'px',
      description: 'Size of a grid cell.',
    }),
    color: color({
      theme: 'accent',
      default: '#5ad8ff',
      description: 'Color of the overlay.',
    }),
    intensity: float({
      default: 0.6,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'Brightness of the grid and brackets.',
    }),
    sweep: float({
      default: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Brightness of the scan sweep.',
    }),
    sweepSpeed: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Sweeps every four seconds at 1.',
    }),
    fade: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much the grid fades toward the edges.',
    }),
  },
  presets: {
    targeting: { gridSize: 48, intensity: 0.9, sweep: 0.4 },
    subtle: { intensity: 0.3, sweep: 0.1 },
    dense: { gridSize: 16, intensity: 0.4 },
    alert: { color: '#ff4d5e', sweep: 0.5, sweepSpeed: 2 },
  },
  fragment,
});
