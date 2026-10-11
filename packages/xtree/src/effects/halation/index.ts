import { color, defineEffect, float, int } from '../../effect/index.js';
import { bloomChain } from '../bloom/chain.js';
import fragment from './composite.glsl';

/** The red glow film shows around bright lights. */
export const halation = defineEffect({
  name: 'halation',
  meta: {
    title: 'Halation',
    family: 'lens',
    story: 'X4.9',
    description:
      'The red-orange glow around bright lights on film, where light bounced off the film base and exposed the red layer again.',
    related: ['bloom', 'film-grain', 'bleach-bypass'],
  },
  sampling: 'input',
  params: {
    intensity: float({
      default: 0.6,
      min: 0,
      max: 3,
      step: 0.05,
      description: 'Strength of the glow.',
    }),
    threshold: float({
      default: 0.8,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which highlights halate.',
    }),
    knee: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Softness of the threshold.',
    }),
    radius: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Spread of the glow; halation is tighter than bloom.',
    }),
    levels: int({
      default: 4,
      min: 2,
      max: 6,
      step: 1,
      description: 'Blur levels; fewer keep the glow close to the highlight.',
    }),
    tint: color({ default: '#ff4a1c', description: 'Color of the glow.' }),
  },
  presets: {
    film: { intensity: 0.5, radius: 0.3 },
    strong: { intensity: 1.4, threshold: 0.6 },
    tight: { radius: 0.15, levels: 3 },
    golden: { tint: '#ff9a2e', intensity: 0.8 },
  },
  textures: ['bloom'],
  fragment,
  setup(context) {
    return bloomChain(context as never);
  },
});
