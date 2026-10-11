import {
  bool,
  defineTransition,
  float,
  seed,
  select,
  texture,
} from '../../effect/index.js';
import { noiseFbmChunks } from '../../shaders/maps.js';
import fragment from './transition.glsl';

/** Crossfade, noise dissolve or luma wipe between two images. */
export const crossfade = defineTransition({
  name: 'crossfade',
  meta: {
    title: 'Crossfade & luma wipe',
    family: 'transition',
    story: 'X13.2',
    description:
      'Blends to the next image everywhere at once, through noise, or along a luma pattern (linear, radial, diamond or spiral) with a soft edge that can glow in the theme accent. A luma texture of your own drives the wipe when set.',
    related: [],
  },
  fallback: 'hcss-depth',
  chunks: [noiseFbmChunks],
  params: {
    pattern: select({
      options: ['fade', 'noise', 'linear', 'radial', 'diamond', 'spiral'],
      default: 'noise',
      description:
        'Order in which pixels change: all at once, in noisy patches, or along a shape.',
    }),
    softness: float({
      default: 0.15,
      min: 0.001,
      max: 1,
      step: 0.005,
      description: 'Width of the blend edge, as a fraction of the wipe.',
    }),
    angle: float({
      default: 0,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Linear: direction the wipe travels.',
    }),
    scale: float({
      default: 4,
      min: 0.5,
      max: 32,
      step: 0.5,
      description:
        'Noise: size of the patches (higher is finer). Spiral: number of turns.',
    }),
    invert: bool({
      default: false,
      description:
        'Run the pattern backwards, for example radial from the edges in.',
    }),
    edgeGlow: float({
      default: 0,
      min: 0,
      max: 4,
      step: 0.05,
      description:
        'Accent color added along the moving edge. Above about 0.6, a glow sweeping across the screen within a second can count as flashing (WCAG 2.3.1).',
    }),
    luma: texture({
      dimension: '2d',
      description:
        'A grayscale image whose dark areas change first; overrides the pattern when set.',
    }),
    seed: seed(),
  },
  presets: {
    dissolve: { pattern: 'noise', softness: 0.08, scale: 8 },
    iris: { pattern: 'radial', softness: 0.1, edgeGlow: 0.6 },
    sweep: { pattern: 'linear', angle: -20, softness: 0.25 },
    vortex: { pattern: 'spiral', scale: 2, softness: 0.2 },
  },
  fragment,
});
