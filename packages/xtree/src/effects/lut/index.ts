import { defineEffect, float, select, texture } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import { lookSample, lutLooks } from './lut.js';
import fragment from './shader.glsl';

export {
  cubeSample,
  generateLut,
  lookSample,
  lutLooks,
  parseCubeLut,
  type CubeLut,
  type LutFunction,
} from './lut.js';

/** Color grading through a 3D lookup table, such as a `.cube` file from a grading tool. */
export const lut = defineEffect({
  name: 'lut',
  meta: {
    title: 'LUT color grading',
    family: 'color',
    story: 'X3.5',
    description:
      'Grades the image through a 3D lookup table, such as a `.cube` file exported from Resolve, Premiere or Photoshop, with tetrahedral interpolation. Four looks are built in.',
    related: ['brightness-contrast', 'gradient-map', 'hue-saturation'],
  },
  chunks: [colorSpaceChunks],
  params: {
    lut: texture({
      dimension: '3d',
      default: 'tealOrange',
      description:
        'The LUT: a 3D texture (see createSampleTexture and parseCubeLut), the name of a built-in look, or null to bypass.',
      samples: {
        identity: lookSample(lutLooks.identity),
        tealOrange: lookSample(lutLooks.tealOrange),
        warmFilm: lookSample(lutLooks.warmFilm),
        coolNight: lookSample(lutLooks.coolNight),
        bleachBypass: lookSample(lutLooks.bleachBypass),
      },
    }),
    intensity: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the graded image.',
    }),
    space: select({
      options: ['srgb', 'linear'],
      default: 'srgb',
      description:
        'Whether the LUT expects display-encoded sRGB input (most .cube files) or linear values.',
      optionLabels: { srgb: 'sRGB', linear: 'Linear' },
    }),
  },
  presets: {
    tealOrange: { lut: 'tealOrange' },
    warmFilm: { lut: 'warmFilm' },
    coolNight: { lut: 'coolNight' },
    bleachBypass: { lut: 'bleachBypass', intensity: 0.85 },
  },
  fragment,
});
