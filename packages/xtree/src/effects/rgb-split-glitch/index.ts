import { defineEffect, float, int, select } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Digital RGB split: red and blue jump apart in quick, seeded steps. */
export const rgbSplitGlitch = defineEffect({
  name: 'rgb-split-glitch',
  meta: {
    title: 'RGB split glitch',
    family: 'glitch',
    story: 'X6.1',
    description:
      'Red and blue jump apart in quick, seeded steps, like a misaligned digital signal. Bursts switch on and off at most 1.5 times a second, well under the WCAG flash threshold, and only shift channels rather than flashing brightness.',
    related: ['chromatic-aberration'],
  },
  sampling: 'input',
  motion: { settle: { jitter: 0, trigger: 'always' } },
  chunks: [noiseHashChunks],
  params: {
    amount: float({
      default: 0.008,
      min: 0,
      max: 0.06,
      step: 0.001,
      description: 'Channel offset as a fraction of the frame height.',
    }),
    angle: float({
      default: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Direction of the split.',
    }),
    jitter: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much the offset and angle vary from step to step.',
    }),
    rate: float({
      default: 8,
      min: 1,
      max: 20,
      step: 0.5,
      unit: '/s',
      description: 'Jitter steps per second.',
    }),
    trigger: select({
      options: ['bursts', 'always'],
      default: 'bursts',
      description:
        'Bursts glitch in random windows; always keeps the split on.',
    }),
    burstChance: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Bursts mode: the fraction of windows that glitch.',
    }),
    seed: int({
      default: 1,
      min: 0,
      max: 9999,
      step: 1,
      description: 'Changes the random sequence.',
    }),
  },
  presets: {
    subtle: { amount: 0.003, jitter: 0.3, burstChance: 0.2 },
    broadcast: { amount: 0.012, jitter: 0.8, rate: 12, burstChance: 0.5 },
    constant: { trigger: 'always', amount: 0.006, jitter: 0 },
    diagonal: { trigger: 'always', amount: 0.01, angle: 45, jitter: 0.4 },
  },
  fragment,
});
