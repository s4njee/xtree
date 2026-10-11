import { bool, defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** Re-projects the frame as a fisheye or a Panini view. */
export const fisheye = defineEffect({
  name: 'fisheye',
  meta: {
    title: 'Fisheye & Panini',
    family: 'lens',
    story: 'X4.11',
    description:
      'Re-projects the perspective frame: an equidistant fisheye that bulges the center, or a Panini projection that keeps verticals straight and widens the view without stretching the edges.',
    related: ['lens-distortion', 'bulge', 'chromatic-aberration'],
  },
  sampling: 'input',
  params: {
    projection: select({
      options: ['fisheye', 'panini'],
      default: 'fisheye',
      structural: true,
      description: 'The projection to apply.',
    }),
    strength: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        '0 leaves the image unchanged; 1 is a full fisheye or classic Panini.',
    }),
    fov: float({
      default: 60,
      min: 20,
      max: 120,
      step: 1,
      unit: '°',
      description:
        'Diagonal field of view the original frame was rendered with.',
    }),
    zoom: float({
      default: 1,
      min: 0.5,
      max: 2,
      step: 0.01,
      description: 'Crops in (above 1) or shows more (below 1).',
    }),
    edges: bool({
      default: true,
      description:
        'Black outside the original frame (otherwise the edge pixels are stretched).',
    }),
  },
  presets: {
    actionCam: { strength: 0.8, zoom: 1.1 },
    peephole: { strength: 1, zoom: 0.8 },
    panini: { projection: 'panini', strength: 1, fov: 100, zoom: 1.15 },
    gentle: { strength: 0.3 },
  },
  fragment,
});
