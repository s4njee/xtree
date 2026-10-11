import { color, defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Ink lines where depth or surface direction changes, or around selected objects. */
export const outline = defineEffect({
  name: 'outline',
  meta: {
    title: 'Outline',
    family: 'stylize',
    story: 'X8.1',
    description:
      'Draws lines where the depth or the surface direction changes, for a toon or technical-drawing look. Give it a selection mask to outline only those objects instead, through other objects with x-ray.',
    related: ['glow', 'selective-bloom', 'halftone'],
  },
  buffers: (effect) =>
    effect.maskKind
      ? []
      : effect.edges === 'depth'
        ? ['depth']
        : ['depth', 'normal'],
  masking: 'custom',
  params: {
    thickness: float({
      default: 1.5,
      min: 0.5,
      max: 6,
      step: 0.1,
      unit: 'px',
      description: 'Line width.',
    }),
    color: color({
      theme: 'accent',
      default: '#7cc4ff',
      description: 'Line color.',
    }),
    depthThreshold: float({
      default: 0.1,
      min: 0.005,
      max: 1,
      step: 0.005,
      description:
        'How sharply depth must bend (relative to its distance) to count as an edge.',
    }),
    normalThreshold: float({
      default: 0.4,
      min: 0.02,
      max: 2,
      step: 0.01,
      description:
        'How sharply the surface direction must turn to count as a crease.',
    }),
    edges: select({
      options: ['depthAndNormals', 'depth'],
      default: 'depthAndNormals',
      structural: true,
      description:
        'Find silhouettes from depth only, or creases too from the normal buffer (one extra scene render).',
      optionLabels: { depthAndNormals: 'Depth and normals' },
    }),
    style: select({
      options: ['overlay', 'ink'],
      default: 'overlay',
      description: 'Draw lines over the image, or on plain paper.',
    }),
    paper: color({
      theme: 'background',
      default: '#f3efe6',
      description: 'Ink style: background color.',
    }),
  },
  presets: {
    toon: { color: '#101018', thickness: 2 },
    blueprint: {
      style: 'ink',
      paper: '#123a73',
      color: '#d7e9ff',
      thickness: 1,
    },
    sketch: {
      style: 'ink',
      color: '#2b2b33',
      thickness: 1.2,
      normalThreshold: 0.25,
    },
    silhouette: { edges: 'depth', color: '#ffd166', thickness: 2.5 },
  },
  fragment,
});
