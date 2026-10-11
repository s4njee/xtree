import { bool, defineEffect, float, select, vec2 } from '../../effect/index.js';
import { samplingSpiralChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Camera-style depth of field with round or hexagonal bokeh. */
export const depthOfField = defineEffect({
  name: 'depth-of-field',
  meta: {
    title: 'Depth of field',
    family: 'lens',
    story: 'X4.4',
    description:
      'Blurs what is nearer or farther than the focus distance, as a wide-aperture lens does. Bright highlights open into round or hexagonal bokeh, and focus can follow a point on screen.',
    related: ['tilt-shift', 'blur', 'depth-fog'],
  },
  sampling: 'input',
  buffers: ['depth'],
  chunks: [samplingSpiralChunks],
  params: {
    focusMode: select({
      options: ['distance', 'point'],
      default: 'distance',
      description:
        'Focus at a fixed distance, or on whatever is under the focus point.',
    }),
    focusDistance: float({
      default: 7,
      min: 0.1,
      max: 100,
      step: 0.1,
      description: 'Distance mode: distance in focus, in scene units.',
    }),
    focusPoint: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Point mode: screen position to focus on, in UV coordinates.',
    }),
    focusRange: float({
      default: 1.5,
      min: 0,
      max: 50,
      step: 0.1,
      description: 'Depth around the focus distance that stays sharp.',
    }),
    aperture: float({
      default: 2,
      min: 0,
      max: 10,
      step: 0.05,
      description: 'Lens opening: larger values blur sooner away from focus.',
    }),
    maxBlur: float({
      default: 12,
      min: 1,
      max: 32,
      step: 0.5,
      unit: 'px',
      description: 'Largest blur radius.',
    }),
    shape: select({
      options: ['circle', 'hexagon'],
      default: 'circle',
      description: 'Bokeh shape.',
    }),
    quality: select({
      options: ['low', 'medium', 'high'],
      default: 'medium',
      description:
        'Sample density. Cost grows with the square of the blur radius.',
    }),
    showFocus: bool({
      default: false,
      description:
        'Tint what is in focus green, near blur red and far blur blue.',
    }),
  },
  presets: {
    portrait: { focusDistance: 7, focusRange: 0.8, aperture: 4, maxBlur: 16 },
    macro: { focusDistance: 5.2, focusRange: 0.3, aperture: 8, maxBlur: 20 },
    hexBokeh: { shape: 'hexagon', aperture: 3, maxBlur: 18 },
    subtle: { aperture: 1, maxBlur: 6, quality: 'low' },
  },
  fragment,
});
