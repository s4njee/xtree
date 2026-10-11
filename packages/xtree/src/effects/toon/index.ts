import {
  color,
  defineMaterialEffect,
  float,
  gradient,
  int,
  select,
} from '../../effect/index.js';
import fragment from './fragment.glsl';

/** Cel shading: banded light, a stepped highlight and a hard rim. */
export const toon = defineMaterialEffect({
  name: 'toon',
  meta: {
    title: 'Toon shading',
    family: 'material',
    story: 'X12.5',
    description:
      'Cel shading on any lit material: the light snaps into flat bands (or follows a ramp you draw) while each surface keeps its color, the highlight becomes one flat spot, and an optional hard rim outlines the silhouette.',
    related: ['posterize', 'edges', 'fresnel-glow'],
    demo: { selection: ['knot', 'box'] },
  },
  params: {
    mode: select({
      options: ['bands', 'ramp'],
      default: 'bands',
      description: 'Even bands of light, or a brightness ramp you draw.',
    }),
    bands: int({
      default: 3,
      min: 2,
      max: 8,
      step: 1,
      description: 'Number of light bands.',
    }),
    hardness: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How sharply the bands step; lower values soften them.',
    }),
    ramp: gradient({
      default: [
        [0, '#262626'],
        [0.45, '#262626'],
        [0.5, '#9a9a9a'],
        [0.85, '#9a9a9a'],
        [0.9, '#ffffff'],
        [1, '#ffffff'],
      ],
      description:
        'Ramp mode: brightness from dark (left) to lit (right); its gray levels set the shading.',
    }),
    specular: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the flat highlight.',
    }),
    specularThreshold: float({
      default: 0.85,
      min: 0.3,
      max: 1,
      step: 0.01,
      description: 'Brightness above which the highlight appears.',
    }),
    specularColor: color({
      default: '#ffffff',
      description: 'Color of the highlight.',
    }),
    rim: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the hard rim.',
    }),
    rimWidth: float({
      default: 0.3,
      min: 0.01,
      max: 0.9,
      step: 0.01,
      description: 'Width of the rim.',
    }),
    rimColor: color({
      default: '#ffffff',
      description: 'Rim color.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original shading and the toon shading.',
    }),
  },
  presets: {
    anime: { bands: 2, rim: 0.8, rimWidth: 0.2 },
    soft: { bands: 4, hardness: 0.6, specular: 0.5 },
    comic: { bands: 3, rim: 1, rimWidth: 0.35, rimColor: '#101018' },
    flat: { bands: 2, specular: 0 },
    ramp: { mode: 'ramp' },
  },
  fragment,
});
