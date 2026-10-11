import { bool, defineMaterialEffect, float } from '../../effect/index.js';
import { noiseSimplexChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';
import vertex from './vertex.glsl';

/** Moves vertices along their normals with drifting noise. */
export const wobble = defineMaterialEffect({
  name: 'wobble',
  meta: {
    title: 'Vertex wobble',
    family: 'material',
    story: 'X12.8',
    description:
      'Makes surfaces breathe and wobble: vertices move along their normals by slowly drifting noise, and the normals are recomputed so lighting follows the new shape. Needs a reasonably dense mesh. It holds still when motion is off.',
    related: ['flow-warp', 'dissolve', 'hologram'],
    demo: { selection: ['knot'] },
  },
  chunks: [noiseSimplexChunks],
  motion: 'freeze',
  params: {
    amplitude: float({
      default: 0.08,
      min: 0,
      max: 1,
      step: 0.005,
      unit: 'scene units',
      description: 'How far vertices move; 0 turns it off.',
    }),
    frequency: float({
      default: 2,
      min: 0.1,
      max: 20,
      step: 0.1,
      description: 'Size of the bulges: higher values make smaller ones.',
    }),
    speed: float({
      default: 0.4,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'How fast the bulges drift.',
    }),
    recomputeNormals: bool({
      default: true,
      description: 'Light the displaced shape rather than the original one.',
    }),
  },
  presets: {
    jelly: { amplitude: 0.12, frequency: 1.2, speed: 0.8 },
    breathing: { amplitude: 0.05, frequency: 0.6, speed: 0.3 },
    boiling: { amplitude: 0.04, frequency: 6, speed: 1.5 },
  },
  vertex,
  fragment,
});
