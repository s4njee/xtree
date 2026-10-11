import {
  bool,
  color,
  defineEffect,
  float,
  int,
  vec2,
  vec3,
} from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Light shafts streaming from a bright light past the objects in front of it. */
export const godRays = defineEffect({
  name: 'god-rays',
  meta: {
    title: 'God rays',
    family: 'atmosphere',
    story: 'X10.3',
    description:
      'Light shafts that stream from a light past the objects in front of it, as sunbeams through dusty air. The light is a point on screen or a position in the scene.',
    related: ['volumetric-fog', 'bloom', 'depth-fog'],
  },
  sampling: 'input',
  buffers: ['depth'],
  chunks: [noiseHashChunks],
  params: {
    position: vec2({
      default: [0.25, 0.42],
      min: -0.5,
      max: 1.5,
      step: 0.01,
      description:
        'Light position on screen (UV), when not following a scene position.',
    }),
    worldLight: bool({
      default: false,
      description: 'Use a position in the scene for the light instead.',
    }),
    lightWorld: vec3({
      default: [-2.1, 0.75, 0.4],
      min: -50,
      max: 50,
      step: 0.1,
      description: 'Light position in world units, when following the scene.',
    }),
    intensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the shafts.',
    }),
    density: float({
      default: 0.9,
      min: 0.1,
      max: 1,
      step: 0.01,
      description: 'How far toward the light each pixel looks (1 reaches it).',
    }),
    decay: float({
      default: 0.97,
      min: 0.8,
      max: 1,
      step: 0.001,
      description: 'How quickly light fades along a shaft.',
    }),
    weight: float({
      default: 0.01,
      min: 0.001,
      max: 0.2,
      step: 0.001,
      description: 'Contribution of each sample.',
    }),
    samples: int({
      default: 48,
      min: 8,
      max: 128,
      step: 1,
      description: 'Samples per pixel along the shaft.',
    }),
    threshold: float({
      default: 1,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which pixels cast light.',
    }),
    skyWeight: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Light from the far background (sky), besides bright pixels.',
    }),
    color: color({ default: '#fff1d6', description: 'Color of the light.' }),
  },
  presets: {
    sunbeams: { intensity: 1.5, decay: 0.98, weight: 0.015 },
    tight: { density: 0.5, decay: 0.95 },
    sky: { skyWeight: 1, threshold: 3, position: [0.5, 1] },
    followOrb: { worldLight: true },
  },
  fragment,
});
