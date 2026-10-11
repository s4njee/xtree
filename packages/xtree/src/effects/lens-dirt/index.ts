import { defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks, noiseValueChunks } from '../../shaders/maps.js';
import { bloomChain } from '../bloom/chain.js';
import fragment from './composite.glsl';

/** Dirt and dust on the lens, lit up by bright light. */
export const lensDirt = defineEffect({
  name: 'lens-dirt',
  meta: {
    title: 'Lens dirt',
    family: 'lens',
    story: 'X4.10',
    description:
      'Smudges, dust and rings on the lens that only show where bright light spreads across them, like a dirty camera pointed at the sun.',
    related: ['bloom', 'lens-flare', 'film-grain'],
  },
  sampling: 'input',
  chunks: [noiseValueChunks, noiseHashChunks],
  params: {
    intensity: float({
      default: 2,
      min: 0,
      max: 8,
      step: 0.1,
      description: 'Brightness of the lit dirt.',
    }),
    threshold: float({
      default: 0.9,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which light catches the dirt.',
    }),
    knee: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Softness of the threshold.',
    }),
    radius: float({
      default: 0.85,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How far light spreads across the lens.',
    }),
    levels: int({
      default: 6,
      min: 3,
      max: 8,
      step: 1,
      description: 'Blur levels of the light that catches the dirt.',
    }),
    scale: float({
      default: 1,
      min: 0.3,
      max: 3,
      step: 0.05,
      description: 'Size of the smudges and specks.',
    }),
    seed: float({
      default: 0,
      min: 0,
      max: 100,
      step: 1,
      description: 'Picks a different pattern of dirt.',
    }),
  },
  presets: {
    dusty: { scale: 0.6, intensity: 2.5 },
    smudged: { scale: 2, intensity: 1.5 },
    bright: { intensity: 5, threshold: 0.6 },
    clean: { intensity: 0.8 },
  },
  textures: ['bloom'],
  fragment,
  setup(context) {
    return bloomChain(context as never);
  },
});
