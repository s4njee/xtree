import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks, noiseHashChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Photographic grain that sits in the shadows and midtones and changes every film frame. */
export const filmGrain = defineEffect({
  name: 'film-grain',
  meta: {
    title: 'Film grain',
    family: 'lens',
    story: 'X4.2',
    description:
      'Photographic grain: fine noise that sits mostly in shadows and midtones and changes at a film frame rate. With motion off it holds a single grain pattern.',
    related: ['digital-noise', 'vignette', 'lut'],
  },
  motion: 'freeze',
  chunks: [colorSpaceChunks, noiseHashChunks],
  params: {
    intensity: float({
      default: 0.12,
      min: 0,
      max: 0.6,
      step: 0.005,
      description: 'Strength of the grain.',
    }),
    size: float({
      default: 1.5,
      min: 1,
      max: 6,
      step: 0.1,
      unit: 'px',
      description: 'Size of a grain particle.',
    }),
    luminanceResponse: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much less grain shows in highlights, as with film stock.',
    }),
    colored: bool({
      default: false,
      description:
        'Separate grain per color channel, like color negative film.',
    }),
    animated: bool({
      default: true,
      description: 'Change the grain every frame.',
    }),
    speed: float({
      default: 24,
      min: 1,
      max: 60,
      step: 1,
      unit: 'fps',
      description: 'How often the grain changes.',
    }),
  },
  presets: {
    fine: { intensity: 0.07, size: 1 },
    stock35: { intensity: 0.14, size: 1.6 },
    heavy: { intensity: 0.3, size: 2.6, luminanceResponse: 0.3 },
    color: { colored: true, intensity: 0.16 },
  },
  fragment,
});
