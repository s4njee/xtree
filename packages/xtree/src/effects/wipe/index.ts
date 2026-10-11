import {
  bool,
  defineTransition,
  float,
  select,
  vec2,
} from '../../effect/index.js';
import fragment from './transition.glsl';

/** Directional, radial and clock wipes. */
export const wipe = defineTransition({
  name: 'wipe',
  meta: {
    title: 'Wipe',
    family: 'transition',
    story: 'X13.3',
    description:
      'Reveals the next image behind a moving edge: a straight line at any angle, a circle growing from a center, or a clock hand sweeping around it. The edge can be soft and glow in the theme accent.',
    related: ['crossfade', 'holo-sweep'],
  },
  fallback: 'hcss-swing-left',
  params: {
    pattern: select({
      options: ['linear', 'radial', 'clock'],
      default: 'linear',
      description: 'Shape of the moving edge.',
    }),
    angle: float({
      default: 0,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description:
        'Linear: direction the edge travels. Clock: where the hand starts.',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Radial and clock: center of the wipe (UV).',
    }),
    softness: float({
      default: 0.05,
      min: 0.001,
      max: 0.5,
      step: 0.005,
      description: 'Width of the edge, as a fraction of the wipe.',
    }),
    reverse: bool({
      default: false,
      description: 'Run backwards: right to left, edges in, or anticlockwise.',
    }),
    edgeGlow: float({
      default: 0,
      min: 0,
      max: 4,
      step: 0.05,
      description:
        'Accent color added along the edge. Above about 0.6, a glow sweeping across the screen within a second can count as flashing (WCAG 2.3.1).',
    }),
  },
  presets: {
    iris: { pattern: 'radial', softness: 0.02, edgeGlow: 1 },
    clock: { pattern: 'clock', softness: 0.01 },
    curtain: { angle: -90, softness: 0.2 },
    glowing: { angle: 30, softness: 0.08, edgeGlow: 0.5 },
  },
  fragment,
});
