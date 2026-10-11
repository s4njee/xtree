import { defineTransition, float } from '../../effect/index.js';
import { colorSpectralChunks } from '../../shaders/maps.js';
import fragment from './transition.glsl';

/** A spectral band that sweeps the next image in. */
export const holoSweep = defineTransition({
  name: 'holo-sweep',
  meta: {
    title: 'Holographic sweep',
    family: 'transition',
    story: 'X13.10',
    description:
      'A band of rainbow light sweeps across like a hologram catching the light, bending the image as it passes and leaving the next image behind it.',
    related: ['holographic-foil', 'wipe', 'prism'],
  },
  fallback: 'hcss-swing-left',
  chunks: [colorSpectralChunks],
  params: {
    angle: float({
      default: 20,
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Direction the band travels.',
    }),
    width: float({
      default: 0.18,
      min: 0.02,
      max: 0.6,
      step: 0.01,
      description: 'Width of the band, as a fraction of the sweep.',
    }),
    intensity: float({
      default: 1.2,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the spectrum.',
    }),
    refraction: float({
      default: 0.02,
      min: 0,
      max: 0.1,
      step: 0.001,
      description:
        'How far the band bends the image, as a fraction of the frame.',
    }),
  },
  presets: {
    foil: { width: 0.3, intensity: 2, refraction: 0.03 },
    thin: { width: 0.06, intensity: 2.5 },
    vertical: { angle: -90 },
  },
  fragment,
});
