import { bool, defineEffect, select, vec2 } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Mirror symmetry across a vertical or horizontal line, or both. */
export const mirror = defineEffect({
  name: 'mirror',
  meta: {
    title: 'Mirror',
    family: 'distortion',
    story: 'X9.7',
    description:
      'Reflects one side of the frame onto the other across a vertical or horizontal line (or both, for four-way symmetry).',
    related: ['kaleidoscope', 'twirl'],
  },
  sampling: 'input',
  params: {
    axis: select({
      options: ['vertical', 'horizontal', 'both'],
      default: 'vertical',
      description:
        'The mirror line: vertical reflects left onto right, horizontal reflects top onto bottom.',
    }),
    position: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Where the mirror lines are, in UV coordinates.',
    }),
    flip: bool({
      default: false,
      description:
        'Keep the other side instead (right onto left, bottom onto top).',
    }),
  },
  presets: {
    fourWay: { axis: 'both' },
    reflection: { axis: 'horizontal', position: [0.5, 0.4] },
    rightHalf: { flip: true },
    offCenter: { position: [0.35, 0.5] },
  },
  fragment,
});
