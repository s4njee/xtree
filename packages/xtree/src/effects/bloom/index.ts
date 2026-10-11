import { color, defineEffect, float, int } from '../../effect/index.js';
import { bloomChain } from './chain.js';
import fragment from './composite.glsl';

/** Physically based bloom: a mip-chain blur of the highlights, added back in linear HDR. */
export const bloom = defineEffect({
  name: 'bloom',
  meta: {
    title: 'Bloom',
    family: 'glow',
    story: 'X5.2',
    description:
      'Light bleeding around bright areas. Highlights above a soft threshold are blurred through a chain of half-resolution buffers and added back before tone mapping.',
    related: ['vignette', 'chromatic-aberration', 'holographic-foil'],
  },
  sampling: 'input',
  params: {
    intensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'How much of the blurred light is added back.',
    }),
    threshold: float({
      default: 1,
      min: 0,
      max: 8,
      step: 0.05,
      description:
        'Linear brightness above which pixels bloom. 1 is the brightest non-HDR white.',
    }),
    knee: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Softness of the threshold, as a fraction of it.',
    }),
    radius: float({
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Spread: low values keep the glow tight, high values favor the widest blur levels.',
    }),
    levels: int({
      default: 6,
      min: 2,
      max: 8,
      step: 1,
      description:
        'Number of half-resolution blur levels. More levels reach further and cost a little more.',
    }),
    tint: color({
      theme: 'accent',
      default: '#ffffff',
      description: 'Color multiplied into the glow.',
    }),
  },
  presets: {
    subtle: { intensity: 0.5, threshold: 1.2 },
    dreamy: { intensity: 1.4, threshold: 0.6, knee: 0.8, radius: 0.85 },
    neon: { intensity: 2, threshold: 0.9, knee: 0.2, radius: 0.5 },
    wide: { levels: 8, radius: 0.9, intensity: 1.2 },
  },
  textures: ['bloom'],
  fragment,
  setup(context) {
    return bloomChain(context as never);
  },
});
