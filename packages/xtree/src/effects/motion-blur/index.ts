import { defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Per-object and camera motion blur from the velocity buffer. */
export const motionBlur = defineEffect({
  name: 'motion-blur',
  meta: {
    title: 'Motion blur',
    family: 'lens',
    story: 'X4.8',
    description:
      'Blurs moving objects and camera motion along their path, as a camera shutter does. Reads the velocity buffer, which the composer renders only while an effect needs it.',
    related: ['directional-blur', 'radial-blur', 'depth-of-field'],
  },
  sampling: 'input',
  buffers: ['velocity'],
  chunks: [noiseHashChunks],
  params: {
    intensity: float({
      default: 1,
      min: 0,
      max: 3,
      step: 0.05,
      description:
        'Shutter length as a fraction of the frame time: 1 blurs over one frame of motion (a 360° shutter), 0.5 is the classic film look.',
    }),
    samples: int({
      default: 12,
      min: 2,
      max: 32,
      step: 1,
      description: 'Samples along the motion; more are smoother.',
    }),
    maxBlur: float({
      default: 0.05,
      min: 0.005,
      max: 0.2,
      step: 0.005,
      description:
        'Longest blur as a fraction of the frame, so very fast motion stays readable.',
    }),
  },
  quality: { low: { samples: 5 }, medium: { samples: 8 } },
  presets: {
    film: { intensity: 0.5 },
    fast: { intensity: 2, samples: 24, maxBlur: 0.1 },
    subtle: { intensity: 0.3, samples: 8 },
    streaky: { intensity: 3, samples: 32, maxBlur: 0.2 },
  },
  fragment,
});
