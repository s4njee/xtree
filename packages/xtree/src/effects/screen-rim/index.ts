import { color, defineEffect, float } from '../../effect/index.js';
import fragment from './shader.glsl';

/** A rim light on every object, from the depth and normal buffers. */
export const screenRim = defineEffect({
  name: 'screen-rim',
  meta: {
    title: 'Screen-space rim light',
    family: 'atmosphere',
    story: 'X10.5',
    description:
      'Adds a rim light to every object’s silhouette from the depth and normal buffers, like a backlight separating subjects from the background, without touching materials.',
    related: ['fresnel-glow', 'outline', 'god-rays'],
  },
  buffers: ['depth', 'normal'],
  params: {
    color: color({
      theme: 'accent',
      default: '#9fd8ff',
      description: 'Color of the rim light.',
    }),
    intensity: float({
      default: 1.5,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Brightness (HDR above 1).',
    }),
    width: float({
      default: 3,
      min: 0.5,
      max: 10,
      step: 0.1,
      description: 'Higher values keep the rim closer to the silhouette.',
    }),
    backlight: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Light only edges that stand in front of distant background.',
    }),
    directional: float({
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Light the rims facing one direction more.',
    }),
    angle: float({
      default: 45,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      description: 'Direction of the light for directional rims.',
    }),
  },
  presets: {
    backlit: { intensity: 2.5, width: 5 },
    sunset: { color: '#ffb36b', directional: 0.8, angle: 160 },
    soft: { width: 1.5, intensity: 0.8 },
    neon: { color: '#ff4fd8', intensity: 4, width: 4 },
  },
  fragment,
});
