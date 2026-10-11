import { color, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Edge detection on the image itself: Sobel or Canny-style thin lines. */
export const edges = defineEffect({
  name: 'edges',
  meta: {
    title: 'Edge detect (Sobel, Canny)',
    family: 'stylize',
    story: 'X8.4',
    description:
      'Finds edges in the image itself (not the 3D geometry, unlike outline): Sobel gradients of brightness, optionally thinned to one-pixel lines as Canny does, over the image, on paper, or glowing on black.',
    related: ['outline', 'emboss', 'pencil'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    method: select({
      options: ['sobel', 'canny'],
      default: 'sobel',
      structural: true,
      description:
        'Sobel draws every gradient; Canny keeps only the ridge of each edge.',
    }),
    threshold: float({
      default: 0.25,
      min: 0,
      max: 2,
      step: 0.01,
      description: 'Gradient strength that counts as an edge.',
    }),
    thickness: float({
      default: 1,
      min: 0.5,
      max: 4,
      step: 0.25,
      unit: 'px',
      description: 'Spacing of the samples, which sets the line width.',
    }),
    style: select({
      options: ['overlay', 'ink', 'glow'],
      default: 'overlay',
      structural: true,
      description:
        'Lines over the image, ink on paper, or bright lines on black.',
    }),
    color: color({
      theme: 'accent',
      default: '#7cc4ff',
      description: 'Line color.',
    }),
    paper: color({
      theme: 'background',
      default: '#f3efe6',
      description: 'Ink style: background color.',
    }),
  },
  presets: {
    blueprint: {
      style: 'ink',
      color: '#e8f0ff',
      paper: '#123a73',
      method: 'canny',
    },
    neon: { style: 'glow', color: '#ff4fd8', threshold: 0.15 },
    comic: { style: 'overlay', color: '#111111', thickness: 1.5 },
    sketch: {
      style: 'ink',
      color: '#333333',
      method: 'canny',
      threshold: 0.12,
    },
  },
  fragment,
});
