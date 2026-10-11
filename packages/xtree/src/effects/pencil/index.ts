import { color, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks, noiseValueChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** A pencil drawing of the scene: contours from the geometry, shading in strokes. */
export const pencil = defineEffect({
  name: 'pencil',
  meta: {
    title: 'Pencil sketch',
    family: 'stylize',
    story: 'X8.8',
    description:
      'Redraws the scene as a pencil sketch on paper: contours from the geometry (depth and normals) and the image, and shading in diagonal strokes that pile up in the shadows.',
    related: ['crosshatch', 'outline', 'edges'],
  },
  sampling: 'input',
  buffers: ['depth', 'normal'],
  chunks: [colorSpaceChunks, noiseValueChunks],
  params: {
    lineWidth: float({
      default: 1.25,
      min: 0.5,
      max: 4,
      step: 0.25,
      unit: 'px',
      description: 'Width of the contour lines.',
    }),
    shading: float({
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much stroke shading fills the shadows.',
    }),
    strokeSpacing: float({
      default: 4,
      min: 2,
      max: 12,
      step: 0.5,
      unit: 'px',
      description: 'Distance between shading strokes.',
    }),
    imageEdges: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'How much the image’s own edges are drawn, besides the geometry.',
    }),
    lead: color({
      theme: 'text',
      default: '#2b2b33',
      description: 'Pencil color.',
    }),
    paper: color({
      theme: 'background',
      default: '#f6f2e8',
      description: 'Paper color.',
    }),
    paperGrain: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Texture of the paper.',
    }),
  },
  presets: {
    graphite: { lead: '#3a3a44', shading: 0.9 },
    lineArt: { shading: 0, lineWidth: 1.5 },
    charcoal: {
      lead: '#111114',
      lineWidth: 2.5,
      strokeSpacing: 6,
      paperGrain: 1,
    },
    blueprint: { lead: '#e8f0ff', paper: '#143a6e', shading: 0.4 },
  },
  fragment,
});
