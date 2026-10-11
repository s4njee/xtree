import { defineEffect, float, int, select } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Corrupted-video blocks: rectangles of the image jump sideways with their channels split. */
export const blockDisplacement = defineEffect({
  name: 'block-displacement',
  meta: {
    title: 'Block displacement',
    family: 'glitch',
    story: 'X6.2',
    description:
      'Corrupted-video blocks: random rectangles of the image jump sideways, with a little channel separation. Blocks change a few times a second; bursts switch on and off at most 1.5 times a second.',
    related: ['rgb-split-glitch', 'scanline-tear', 'digital-noise'],
  },
  sampling: 'input',
  motion: { settle: { density: 0 } },
  chunks: [noiseHashChunks],
  params: {
    amount: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How far blocks move.',
    }),
    blockSize: float({
      default: 24,
      min: 4,
      max: 128,
      step: 1,
      unit: 'px',
      description: 'Height of a block; widths vary around twice this.',
    }),
    density: float({
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fraction of blocks that move.',
    }),
    colorShift: float({
      default: 0.008,
      min: 0,
      max: 0.05,
      step: 0.001,
      description: 'Red/blue separation inside moved blocks.',
    }),
    rate: float({
      default: 6,
      min: 1,
      max: 20,
      step: 0.5,
      unit: '/s',
      description: 'How often blocks change.',
    }),
    trigger: select({
      options: ['bursts', 'always'],
      default: 'bursts',
      description: 'Glitch in random bursts, or all the time.',
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
    subtle: { density: 0.08, amount: 0.3 },
    corrupted: {
      trigger: 'always',
      density: 0.35,
      amount: 0.7,
      colorShift: 0.015,
    },
    chunky: { trigger: 'always', blockSize: 64, density: 0.2 },
    fine: { trigger: 'always', blockSize: 8, density: 0.25, amount: 0.4 },
  },
  fragment,
});
