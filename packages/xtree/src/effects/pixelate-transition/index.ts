import { defineTransition, float } from '../../effect/index.js';
import fragment from './transition.glsl';

/** Pixelates out of one image and into the next. */
export const pixelateTransition = defineTransition({
  name: 'pixelate-transition',
  meta: {
    title: 'Pixelate transition',
    family: 'transition',
    story: 'X13.5',
    description:
      'Breaks the image into ever larger blocks, switches to the next image at the coarsest point, then sharpens back down to single pixels.',
    related: ['pixelate', 'glitch-cut', 'crossfade'],
  },
  fallback: 'hcss-depth',
  params: {
    maxCell: float({
      default: 48,
      min: 2,
      max: 256,
      step: 1,
      unit: 'px',
      description: 'Block size at the middle of the transition.',
    }),
    curve: float({
      default: 1.5,
      min: 0.25,
      max: 4,
      step: 0.05,
      description:
        'How the blocks grow: above 1 they stay small longer, below 1 they grow quickly.',
    }),
    switchTime: float({
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much of the transition the switch between images takes; 0 cuts.',
    }),
  },
  presets: {
    chunky: { maxCell: 96, curve: 1 },
    cut: { switchTime: 0 },
    gentle: { maxCell: 24, switchTime: 0.5, curve: 2 },
  },
  fragment,
});
