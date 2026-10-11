import { defineEffect, float, int, select, vec2 } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Zoom or spin blur around a center point. */
export const radialBlur = defineEffect({
  name: 'radial-blur',
  meta: {
    title: 'Radial & zoom blur',
    family: 'glow',
    story: 'X5.5',
    description:
      'Blurs toward or around a center point: a zoom burst that rushes at the viewer, or a spin like a rotating camera.',
    related: ['directional-blur', 'motion-blur', 'lens-distortion'],
  },
  sampling: 'input',
  chunks: [noiseHashChunks],
  params: {
    mode: select({
      options: ['zoom', 'spin'],
      default: 'zoom',
      structural: true,
      description:
        'Blur along lines through the center, or along circles around it.',
    }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Center of the blur, in UV coordinates (follows the pointer in the demo).',
    }),
    strength: float({
      default: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Length of the blur: a fraction of the distance to the center, or of a turn.',
    }),
    samples: int({
      default: 24,
      min: 4,
      max: 64,
      step: 1,
      description: 'Samples per pixel; more are smoother and cost more.',
    }),
  },
  presets: {
    burst: { strength: 0.35, samples: 32 },
    subtle: { strength: 0.06, samples: 12 },
    spin: { mode: 'spin', strength: 0.3, samples: 32 },
    warp: { strength: 0.6, samples: 48 },
  },
  fragment,
});
