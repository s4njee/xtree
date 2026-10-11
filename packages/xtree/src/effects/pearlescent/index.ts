import { defineMaterialEffect, float } from '../../effect/index.js';
import { noiseValueChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** Pearl, opal and pearlescent paint: a pale sheen that changes hue with the angle. */
export const pearlescent = defineMaterialEffect({
  name: 'pearlescent',
  meta: {
    title: 'Pearlescent & opal',
    family: 'material',
    story: 'X11.9',
    description:
      'A pale, glowing sheen that shifts hue as the surface turns away and varies from flake to flake, like pearl, opal or pearlescent car paint.',
    related: ['thin-film', 'foil-material', 'chromatic-rim'],
    demo: { selection: ['knot'] },
  },
  chunks: [noiseValueChunks],
  params: {
    sheen: float({
      default: 0.8,
      min: 0,
      max: 3,
      step: 0.05,
      description: 'Brightness of the sheen.',
    }),
    hueRange: float({
      default: 0.6,
      min: 0,
      max: 2,
      step: 0.01,
      description:
        'How far the hue travels from the center to the rim, in turns.',
    }),
    hueOffset: float({
      default: 0.55,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Hue facing the camera, in turns.',
    }),
    saturation: float({
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Color strength; pearl is pale, opal is vivid.',
    }),
    flakeScale: float({
      default: 0.15,
      min: 0.01,
      max: 1,
      step: 0.005,
      description: 'Size of the flakes, in object units.',
    }),
    flakeVariation: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much the hue varies between flakes.',
    }),
    tintBase: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much the hue also colors the surface itself.',
    }),
  },
  presets: {
    pearl: { saturation: 0.25, sheen: 0.6, flakeVariation: 0.1 },
    opal: {
      saturation: 0.85,
      hueRange: 1.2,
      flakeVariation: 0.8,
      flakeScale: 0.06,
    },
    carPaint: { saturation: 0.6, flakeScale: 0.02, sheen: 1.2 },
    abalone: { saturation: 0.7, hueOffset: 0.4, hueRange: 1.5 },
  },
  fragment,
});
