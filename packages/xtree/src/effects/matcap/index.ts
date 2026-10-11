import {
  color,
  defineMaterialEffect,
  float,
  select,
  texture,
} from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** Replaces or tints shading with a matcap image. */
export const matcap = defineMaterialEffect({
  name: 'matcap',
  meta: {
    title: 'Matcap swap',
    family: 'material',
    story: 'X12.10',
    description:
      'Shades any material from a matcap: a picture of a lit sphere looked up by the surface direction, for clay, chrome or candy looks without lights. A soft clay matcap is built in; set your own image to swap it.',
    related: ['toon', 'triplanar'],
    demo: { selection: ['knot', 'box'] },
  },
  chunks: [colorSpaceChunks],
  params: {
    map: texture({
      dimension: '2d',
      description:
        'The matcap image (sRGB). Without one, a built-in clay matcap is used.',
    }),
    tint: color({
      default: '#d9cfc4',
      description: 'Color multiplied into the matcap.',
    }),
    mode: select({
      options: ['replace', 'multiply'],
      default: 'replace',
      description:
        "Use the matcap as the shading, or multiply it into the material's own.",
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original shading and the matcap.',
    }),
  },
  presets: {
    clay: { tint: '#d9cfc4' },
    jade: { tint: '#5fbf8f' },
    tinted: { mode: 'multiply', tint: '#ffffff' },
    half: { amount: 0.5 },
  },
  fragment,
});
