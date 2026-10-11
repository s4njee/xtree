import {
  bool,
  color,
  defineMaterialEffect,
  float,
} from '../../effect/index.js';
import fragment from './fragment.glsl';

/** A glow on the edges of a surface that face away from the camera. */
export const fresnelGlow = defineMaterialEffect({
  name: 'fresnel-glow',
  meta: {
    title: 'Fresnel glow',
    family: 'material',
    story: 'X12.3',
    description:
      'Adds light where a surface turns away from the camera, the rim lighting of force fields, energy shields and selected objects. Inverted, it lights the faces toward the camera instead.',
    related: ['hologram', 'thin-film', 'glow'],
    demo: { selection: ['knot'] },
  },
  motion: { settle: { pulse: 0 } },
  params: {
    color: color({
      theme: 'accent',
      default: '#5ad8ff',
      description: 'Glow color.',
    }),
    intensity: float({
      default: 2,
      min: 0,
      max: 10,
      step: 0.05,
      description:
        'Brightness at the rim, in linear units (above 1 blooms with HDR effects).',
    }),
    power: float({
      default: 3,
      min: 0.5,
      max: 10,
      step: 0.1,
      description: 'Rim width: higher values hug the silhouette.',
    }),
    bias: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Glow added everywhere, before the rim.',
    }),
    inverted: bool({
      default: false,
      description: 'Light the faces toward the camera instead of the rim.',
    }),
    pulse: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Slow breathing of the brightness, as a fraction of it (stops when motion is off).',
    }),
  },
  presets: {
    shield: { color: '#4cc9ff', intensity: 3, power: 2 },
    selected: { color: '#ffd166', intensity: 2.5, power: 4, pulse: 0.3 },
    ghost: { color: '#c0b3ff', intensity: 1.2, power: 1.5, bias: 0.15 },
    core: { color: '#ff7a3d', inverted: true, power: 2, intensity: 1.5 },
  },
  fragment,
});
