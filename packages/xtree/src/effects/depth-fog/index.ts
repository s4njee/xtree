import {
  bool,
  color,
  defineEffect,
  float,
  select,
} from '../../effect/index.js';
import fragment from './shader.glsl';

/** Fog that thickens with distance from the camera and thins with height. */
export const depthFog = defineEffect({
  name: 'depth-fog',
  meta: {
    title: 'Depth fog',
    family: 'atmosphere',
    story: 'X10.1',
    description:
      'Screen-space fog from the depth buffer: linear or exponential with distance, optionally thinning above a height for ground mist. Works with any material because it runs after the scene renders.',
    related: ['depth-of-field', 'vignette', 'bloom'],
  },
  buffers: ['depth'],
  params: {
    color: color({
      theme: 'surface',
      default: '#6f7f9f',
      description: 'Fog color.',
    }),
    mode: select({
      options: ['linear', 'exponential', 'exponential2'],
      default: 'exponential2',
      description:
        'How density grows with distance: evenly between start and end, or exponentially.',
      optionLabels: { exponential2: 'Exponential squared' },
    }),
    start: float({
      default: 2,
      min: 0,
      max: 100,
      step: 0.1,
      description: 'Distance where fog begins, in scene units.',
    }),
    end: float({
      default: 30,
      min: 0.1,
      max: 500,
      step: 0.5,
      description: 'Linear: distance where fog is thickest.',
    }),
    density: float({
      default: 0.06,
      min: 0,
      max: 1,
      step: 0.002,
      description: 'Exponential: fog per scene unit.',
    }),
    heightFalloff: float({
      default: 0,
      min: 0,
      max: 5,
      step: 0.01,
      description:
        'How quickly fog thins above the base height; 0 fills the whole view.',
    }),
    height: float({
      default: 0,
      min: -50,
      max: 50,
      step: 0.1,
      description: 'Base height of the fog in world units.',
    }),
    maxOpacity: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Thickest the fog gets.',
    }),
    background: bool({
      default: true,
      description: 'Fog the background too (it counts as the far plane).',
    }),
  },
  presets: {
    haze: { density: 0.035, color: '#8c9ab5', maxOpacity: 0.8 },
    groundMist: {
      density: 0.25,
      heightFalloff: 2.5,
      height: 0,
      color: '#9aa7c0',
      background: false,
    },
    night: { color: '#0b0f1c', density: 0.09 },
    linear: { mode: 'linear', start: 4, end: 24 },
  },
  fragment,
});
