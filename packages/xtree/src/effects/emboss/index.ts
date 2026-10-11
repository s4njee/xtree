import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A raised-relief look, lit from one side. */
export const emboss = defineEffect({
  name: 'emboss',
  meta: {
    title: 'Emboss',
    family: 'stylize',
    story: 'X8.11',
    description:
      'Presses the image into a relief lit from one side: edges facing the light rise, the others sink.',
    related: ['edges', 'posterize'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    angle: float({
      default: 135,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Direction the light comes from.',
    }),
    strength: float({
      default: 2,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Height of the relief.',
    }),
    distance: float({
      default: 1,
      min: 0.5,
      max: 4,
      step: 0.25,
      unit: 'px',
      description: 'How wide the raised edges are.',
    }),
    colored: bool({
      default: false,
      description: 'Keep the image’s colors under the relief.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the relief.',
    }),
  },
  presets: {
    metal: { strength: 3, distance: 1.5 },
    colored: { colored: true, strength: 1.5 },
    deep: { strength: 6, distance: 2.5 },
    subtle: { colored: true, strength: 0.8 },
  },
  fragment,
});
