import {
  color,
  defineMaterialEffect,
  float,
  seed,
  select,
  vec2,
} from '../../effect/index.js';
import { noiseFbmChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** Burns a surface away along noise or a height sweep, with a glowing edge. */
export const dissolve = defineMaterialEffect({
  name: 'dissolve',
  meta: {
    title: 'Dissolve',
    family: 'material',
    story: 'X12.2',
    description:
      'Burns the surface away as `progress` goes from 0 to 1, in noisy patches or as a front sweeping up the object, with a glowing edge. Animate `progress` to reveal or remove objects.',
    related: ['fresnel-glow', 'hologram'],
    demo: { selection: ['knot'] },
  },
  chunks: [noiseFbmChunks],
  params: {
    progress: float({
      default: 0.45,
      min: 0,
      max: 1,
      step: 0.005,
      description: 'How much has dissolved: 0 is whole, 1 is gone.',
    }),
    pattern: select({
      options: ['noise', 'sweep'],
      default: 'noise',
      description:
        'Dissolve in noisy patches, or as a front moving up through the height range.',
    }),
    range: vec2({
      default: [0, 2.5],
      min: -50,
      max: 50,
      step: 0.1,
      description: 'Sweep: world heights where the front starts and ends.',
    }),
    noiseScale: float({
      default: 2.5,
      min: 0.1,
      max: 20,
      step: 0.1,
      description: 'Size of the noise patches: higher is finer.',
    }),
    noiseAmount: float({
      default: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Sweep: how ragged the front is.',
    }),
    edgeWidth: float({
      default: 0.06,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: 'Width of the glowing edge, in units of progress.',
    }),
    edgeColor: color({
      theme: 'accent',
      default: '#ff8a3d',
      description: 'Color of the burning edge.',
    }),
    edgeIntensity: float({
      default: 4,
      min: 0,
      max: 20,
      step: 0.1,
      description:
        'Brightness of the edge, in linear units (above 1 blooms with HDR effects).',
    }),
    seed: seed(),
  },
  presets: {
    embers: { edgeColor: '#ff5a1f', edgeIntensity: 6, noiseScale: 3.5 },
    digital: {
      edgeColor: '#4cc9ff',
      edgeWidth: 0.03,
      noiseScale: 8,
      edgeIntensity: 5,
    },
    sweep: { pattern: 'sweep', progress: 0.5, noiseAmount: 0.3 },
    ash: { edgeColor: '#9a8f86', edgeIntensity: 0.6, edgeWidth: 0.12 },
  },
  fragment,
});
