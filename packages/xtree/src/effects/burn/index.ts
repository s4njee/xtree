import { defineTransition, float, seed } from '../../effect/index.js';
import { noiseFbmChunks } from '../../shaders/maps.js';
import fragment from './transition.glsl';

/** Burns the image away along a glowing edge. */
export const burn = defineTransition({
  name: 'burn',
  meta: {
    title: 'Burn',
    family: 'transition',
    story: 'X13.7',
    description:
      'Burns the image away in noisy patches: the paper chars ahead of a glowing edge in the theme accent, and the next image shows through behind it.',
    related: ['crossfade', 'dissolve', 'wipe'],
  },
  fallback: 'hcss-depth',
  chunks: [noiseFbmChunks],
  params: {
    scale: float({
      default: 3,
      min: 0.5,
      max: 20,
      step: 0.1,
      description:
        'Size of the burning patches: higher values make smaller ones.',
    }),
    direction: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much the burn rises from the bottom instead of spreading in patches.',
    }),
    edgeWidth: float({
      default: 0.01,
      min: 0.002,
      max: 0.05,
      step: 0.005,
      description:
        'Width of the glowing edge, as a fraction of the transition; kept thin so the glow never covers much of the frame at once (WCAG 2.3.1).',
    }),
    glow: float({
      default: 3,
      min: 0,
      max: 10,
      step: 0.1,
      description: 'Brightness of the edge, in linear units (above 1 blooms).',
    }),
    charWidth: float({
      default: 0.06,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: 'Width of the charred margin ahead of the edge.',
    }),
    charring: float({
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How dark the charred margin gets.',
    }),
    seed: seed(),
  },
  presets: {
    paper: { direction: 0, scale: 4, charWidth: 0.1 },
    rising: { direction: 0.8, edgeWidth: 0.006 },
    embers: { glow: 6, scale: 8, charWidth: 0.03 },
    clean: { charring: 0, glow: 1.5 },
  },
  fragment,
});
