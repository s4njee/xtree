import {
  color,
  defineMaterialEffect,
  float,
  select,
  texture,
} from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** Projects a texture along the three axes and blends them. */
export const triplanar = defineMaterialEffect({
  name: 'triplanar',
  meta: {
    title: 'Triplanar mapping',
    family: 'material',
    story: 'X12.9',
    description:
      'Wraps a texture around any shape without UVs: it is projected along the three axes and blended by how much the surface faces each, in world space (so it stays put while objects move) or object space (so it moves with them). A tile grid is built in.',
    related: ['matcap', 'toon'],
    demo: { selection: ['knot', 'box', 'floor'] },
  },
  chunks: [colorSpaceChunks],
  params: {
    map: texture({
      dimension: '2d',
      description:
        'The texture to project (sRGB, set to repeat). Without one, a tile grid is used.',
    }),
    scale: float({
      default: 2,
      min: 0.05,
      max: 20,
      step: 0.05,
      description: 'Repeats per scene unit.',
    }),
    sharpness: float({
      default: 4,
      min: 1,
      max: 32,
      step: 0.5,
      description:
        'How sharply the three projections blend: higher values give crisper seams.',
    }),
    space: select({
      options: ['world', 'object'],
      default: 'world',
      description: 'Project in world space or in the object’s own space.',
    }),
    mode: select({
      options: ['multiply', 'replace'],
      default: 'multiply',
      description:
        "Multiply the texture into the lit color, or replace the color and keep only the lighting's brightness.",
    }),
    colorA: color({
      default: '#c9c2b8',
      description: 'Built-in tiles: first color.',
    }),
    colorB: color({
      default: '#8c8378',
      description: 'Built-in tiles: second color.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original color and the mapped one.',
    }),
  },
  presets: {
    tiles: { scale: 3 },
    stuckOn: { space: 'object' },
    soft: { sharpness: 1.5 },
    painted: { mode: 'replace', colorA: '#e8d5b0', colorB: '#4f7d8c' },
  },
  fragment,
});
