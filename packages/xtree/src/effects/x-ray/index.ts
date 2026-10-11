import {
  color,
  defineMaterialEffect,
  float,
  select,
} from '../../effect/index.js';
import fragment from './fragment.glsl';

/** A see-through glowing shell, visible through other objects. */
export const xRay = defineMaterialEffect({
  name: 'x-ray',
  meta: {
    title: 'X-ray',
    family: 'material',
    story: 'X12.7',
    description:
      'Turns a surface into a see-through shell of light, brightest at its edges, that shows through whatever is in front of it. It can draw everywhere, or only where the object is hidden, for spotting players behind walls.',
    related: ['fresnel-glow', 'hologram', 'outline'],
    demo: { selection: ['knot'] },
  },
  params: {
    color: color({
      theme: 'accent',
      default: '#66e0ff',
      description: 'Color of the shell.',
    }),
    intensity: float({
      default: 1.5,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Brightness, in linear units.',
    }),
    edgePower: float({
      default: 2,
      min: 0.25,
      max: 8,
      step: 0.05,
      description: 'How tightly the light hugs the edges.',
    }),
    fill: float({
      default: 0.08,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Light across the faces toward the camera.',
    }),
    occlusion: select({
      options: ['always', 'hidden'],
      default: 'always',
      structural: true,
      description:
        'Draw over everything, or only the parts hidden behind other objects.',
      optionLabels: { hidden: 'Hidden only' },
    }),
  },
  presets: {
    scanner: { color: '#8dff9a', edgePower: 1.5, fill: 0.15 },
    hidden: { occlusion: 'hidden', intensity: 2 },
    ghost: { color: '#d0c4ff', intensity: 0.8, fill: 0.25 },
  },
  settings: (values) => ({
    transparent: true,
    depthWrite: false,
    blending: 'additive',
    doubleSided: true,
    depthFunc: values.occlusion === 'hidden' ? 'greater' : 'always',
  }),
  fragment,
});
