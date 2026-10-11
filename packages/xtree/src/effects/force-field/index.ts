import {
  color,
  defineMaterialEffect,
  float,
  texture,
  vec3,
} from '../../effect/index.js';
import { depthReconstructChunks } from '../../shaders/maps.js';
import fragment from './fragment.glsl';

/** An energy shield: rim, hexagon lattice, hit ripples and intersections. */
export const forceField = defineMaterialEffect({
  name: 'force-field',
  meta: {
    title: 'Force field',
    family: 'material',
    story: 'X12.4',
    description:
      'Turns a mesh (best a sphere or capsule) into a translucent energy shield: a glowing rim, a hexagon lattice that lights up toward the edges, and ripples that spread from a hit. Set `hitPoint` (in object space) and `hitTime = effect.time` to trigger one. Given the scene’s depth, it also draws a bright line where it cuts through other objects.',
    related: ['fresnel-glow', 'x-ray', 'hologram'],
    demo: { selection: ['knot'] },
  },
  chunks: [depthReconstructChunks],
  motion: 'freeze',
  params: {
    color: color({
      theme: 'accent',
      default: '#4cc9ff',
      description: 'Shield color.',
    }),
    intensity: float({
      default: 1.5,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Overall brightness, in linear units.',
    }),
    rimPower: float({
      default: 2.5,
      min: 0.5,
      max: 8,
      step: 0.1,
      description: 'Width of the rim: higher values hug the silhouette.',
    }),
    fill: float({
      default: 0.05,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Glow across the whole shell.',
    }),
    hexScale: float({
      default: 10,
      min: 1,
      max: 60,
      step: 0.5,
      description: 'Number of hexagons around the shell.',
    }),
    hexIntensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the hexagon lattice.',
    }),
    hitPoint: vec3({
      default: [0, 0, 1],
      min: -100,
      max: 100,
      step: 0.01,
      description: 'Where the last hit landed, in object space.',
    }),
    hitTime: float({
      default: -10,
      min: -1e6,
      max: 1e6,
      step: 0.01,
      unit: 's',
      description:
        'When the last hit landed, on the effect’s clock: set it to `effect.time`.',
    }),
    rippleSpeed: float({
      default: 1.5,
      min: 0.1,
      max: 10,
      step: 0.1,
      unit: 'units/s',
      description: 'How fast ripples spread.',
    }),
    rippleStrength: float({
      default: 1.5,
      min: 0,
      max: 5,
      step: 0.05,
      description: 'Brightness of ripples.',
    }),
    sceneDepth: texture({
      dimension: '2d',
      description:
        'A depth texture of the scene without the shield, from the same camera (for example from a depth prepass), for the intersection line.',
    }),
    cameraNear: float({
      default: 0.1,
      min: 0.0001,
      max: 100,
      step: 0.01,
      description: 'Intersection: the camera’s near plane.',
    }),
    cameraFar: float({
      default: 100,
      min: 1,
      max: 1e5,
      step: 1,
      description: 'Intersection: the camera’s far plane.',
    }),
    intersectionWidth: float({
      default: 0.15,
      min: 0.01,
      max: 2,
      step: 0.01,
      unit: 'scene units',
      description: 'Width of the intersection line.',
    }),
  },
  presets: {
    shield: { hexScale: 14, intensity: 2 },
    bubble: { color: '#b48cff', hexIntensity: 0.2, rimPower: 1.5 },
    hit: { hitTime: 0, hitPoint: [0.4, 0.3, 0.9] },
    barrier: { color: '#ff6b3d', hexScale: 24, fill: 0.12 },
  },
  settings: {
    transparent: true,
    depthWrite: false,
    blending: 'additive',
    doubleSided: true,
  },
  fragment,
});
