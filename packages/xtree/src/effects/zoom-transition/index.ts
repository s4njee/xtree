import { defineTransition, float, int, vec2 } from '../../effect/index.js';
import fragment from './transition.glsl';

/** A zoom through radial streaks into the next image. */
export const zoomTransition = defineTransition({
  name: 'zoom-transition',
  meta: {
    title: 'Zoom / warp speed',
    family: 'transition',
    story: 'X13.9',
    description:
      'Rushes into the image with radial speed streaks from a center, then the next image arrives out of the same streaks and settles to its size.',
    related: ['radial-blur', 'morph', 'crossfade'],
  },
  fallback: 'hcss-depth',
  params: {
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Point the zoom rushes toward (UV).',
    }),
    zoom: float({
      default: 0.5,
      min: 0,
      max: 6,
      step: 0.05,
      description:
        'How far the old image zooms in as it leaves. Strong zooms sweep detail across the screen quickly: keep them for transitions longer than a second (WCAG 2.3.1).',
    }),
    streaks: float({
      default: 0.4,
      min: 0,
      max: 0.9,
      step: 0.01,
      description:
        'Length of the speed streaks at the middle, toward the center.',
    }),
    flare: float({
      default: 0.3,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Glow at the center at the fastest point.',
    }),
    samples: int({
      default: 16,
      min: 2,
      max: 32,
      step: 1,
      description: 'Samples along each streak: more are smoother.',
    }),
  },
  presets: {
    warp: { zoom: 0.6, streaks: 0.75, flare: 0.4 },
    punch: { zoom: 0.3, streaks: 0.4, flare: 0 },
    corner: { center: [0.8, 0.7] },
  },
  fragment,
});
