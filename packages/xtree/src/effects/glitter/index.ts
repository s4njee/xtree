import { color, defineEffect, float, int } from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Glitter flakes on surfaces that twinkle as the light or the pointer moves. */
export const glitter = defineEffect({
  name: 'glitter',
  meta: {
    title: 'Glitter',
    family: 'holographic',
    story: 'X11.5',
    description:
      'Scatters tiny tilted flakes over surfaces that catch the light one by one, so they twinkle as the light sweeps or the pointer moves. Give it a selection mask to glitter one object.',
    related: ['holographic-foil', 'foil-material', 'star-streaks'],
    demo: { selection: ['knot'] },
  },
  sampling: 'pixel',
  buffers: ['normal'],
  chunks: [noiseHashChunks],
  motion: 'freeze',
  params: {
    density: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fraction of the surface covered in flakes.',
    }),
    size: float({
      default: 4,
      min: 2,
      max: 16,
      step: 0.5,
      unit: 'px',
      description: 'Size of a flake on screen.',
    }),
    intensity: float({
      default: 4,
      min: 0,
      max: 16,
      step: 0.1,
      description:
        'Brightness of a flake that catches the light (HDR, so it blooms).',
    }),
    color: color({
      theme: 'accent',
      default: '#fff4d6',
      description: 'Flake color.',
    }),
    rainbow: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix toward a different hue per flake.',
    }),
    speed: float({
      default: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description:
        'How fast the light sweeps around (slow enough not to flicker).',
    }),
    followPointer: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much the light follows the pointer instead of sweeping.',
    }),
    seed: int({
      default: 0,
      min: 0,
      max: 99,
      step: 1,
      description: 'Picks a different scatter of flakes.',
    }),
  },
  presets: {
    gold: { color: '#ffcf5a', rainbow: 0 },
    holo: { rainbow: 1, density: 0.5 },
    fine: { size: 2.5, density: 0.6 },
    interactive: { followPointer: 1, speed: 0 },
  },
  fragment,
});
