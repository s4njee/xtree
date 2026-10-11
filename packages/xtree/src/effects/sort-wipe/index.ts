import { bool, defineTransition, float, int } from '../../effect/index.js';
import fragment from './transition.glsl';

/** A wipe whose trailing band shows the next image sorted by brightness. */
export const sortWipe = defineTransition({
  name: 'sort-wipe',
  meta: {
    title: 'Pixel-sort wipe',
    family: 'transition',
    story: 'X13.6',
    description:
      'A wipe with a glitch-art edge: behind the moving front, each line of the next image appears sorted by brightness, as if a pixel sort were running along the direction of travel, before it settles into the image.',
    related: ['pixel-sort', 'wipe', 'glitch-cut'],
  },
  fallback: 'hcss-flip-y',
  params: {
    angle: float({
      default: -90,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Direction the front travels (-90 is downward).',
    }),
    band: float({
      default: 0.35,
      min: 0.02,
      max: 1,
      step: 0.01,
      description: 'Length of the sorted band, as a fraction of the frame.',
    }),
    reverse: bool({
      default: false,
      description: 'Sort brightest first instead of darkest first.',
    }),
    samples: int({
      default: 24,
      min: 4,
      max: 32,
      step: 1,
      description: 'Samples along each streak: more are smoother.',
    }),
  },
  presets: {
    rain: { angle: -90, band: 0.5 },
    sideways: { angle: 0, band: 0.25 },
    bright: { reverse: true },
  },
  fragment,
});
