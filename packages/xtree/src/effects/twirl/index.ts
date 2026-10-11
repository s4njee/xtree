import { defineEffect, float, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** A whirlpool twist around a point. */
export const twirl = defineEffect({
  name: 'twirl',
  meta: {
    title: 'Twirl',
    family: 'distortion',
    story: 'X9.5',
    description:
      'Twists the image around a point like a whirlpool: strongest at the center and fading out by the edge of the radius.',
    related: ['bulge', 'kaleidoscope', 'wave-warp'],
  },
  sampling: 'input',
  params: {
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Center of the twirl, in UV coordinates.',
    }),
    radius: float({
      default: 0.4,
      min: 0.05,
      max: 1.5,
      step: 0.01,
      description: 'Reach of the twirl, as a fraction of the frame height.',
    }),
    angle: float({
      default: 120,
      min: -720,
      max: 720,
      step: 1,
      unit: '°',
      description: 'Rotation at the center; negative twirls the other way.',
    }),
  },
  presets: {
    whirlpool: { angle: 360, radius: 0.5 },
    gentle: { angle: 45 },
    counter: { angle: -180 },
    wide: { radius: 1.2, angle: 200 },
  },
  fragment,
});
