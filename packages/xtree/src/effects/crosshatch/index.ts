import { bool, color, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Pen-and-ink crosshatching: more layers of lines where the image is darker. */
export const crosshatch = defineEffect({
  name: 'crosshatch',
  meta: {
    title: 'Crosshatch',
    family: 'stylize',
    story: 'X8.7',
    description:
      'Redraws the image in pen-and-ink hatching: darker areas get more layers of crossing lines.',
    related: ['halftone', 'pencil', 'edges'],
  },
  chunks: [colorSpaceChunks],
  params: {
    spacing: float({
      default: 6,
      min: 2,
      max: 24,
      step: 0.5,
      unit: 'px',
      description: 'Distance between lines.',
    }),
    angle: float({
      default: 45,
      min: 0,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Angle of the first layer of lines.',
    }),
    darkness: float({
      default: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      description: 'Shifts where layers start: positive draws more lines.',
    }),
    ink: color({
      theme: 'text',
      default: '#1b1b22',
      description: 'Line color.',
    }),
    paper: color({
      theme: 'background',
      default: '#f4efe4',
      description: 'Paper color.',
    }),
    colored: bool({
      default: false,
      description: 'Draw lines in a dark version of the image’s colors.',
    }),
  },
  presets: {
    etching: { spacing: 4, darkness: 0.2 },
    loose: { spacing: 10, angle: 30 },
    colored: { colored: true, spacing: 5 },
    blueprint: { ink: '#e8f0ff', paper: '#123a73' },
  },
  fragment,
});
