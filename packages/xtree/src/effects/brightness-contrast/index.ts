import { defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** The basic image adjustments: brightness, contrast, saturation and vibrance. */
export const brightnessContrast = defineEffect({
  name: 'brightness-contrast',
  meta: {
    title: 'Brightness & contrast',
    family: 'color',
    story: 'X3.1',
    description:
      'The everyday image adjustments: brightness, contrast, saturation and vibrance, applied to display-encoded values so the sliders behave like a photo editor’s.',
    related: ['hue-saturation', 'exposure-gamma', 'lut'],
  },
  chunks: [colorSpaceChunks],
  params: {
    brightness: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Added to every channel.',
    }),
    contrast: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Spreads values away from mid-grey (positive) or flattens them (negative).',
    }),
    saturation: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description: 'Color intensity; −1 is greyscale.',
    }),
    vibrance: float({
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      description:
        'Saturation that favors muted colors, leaving saturated ones and skin tones mostly alone.',
    }),
  },
  presets: {
    punchy: { contrast: 0.25, saturation: 0.15, vibrance: 0.35 },
    faded: { brightness: 0.05, contrast: -0.3, saturation: -0.3 },
    muted: { saturation: -0.55, vibrance: -0.2 },
    bright: { brightness: 0.08, contrast: 0.1 },
  },
  fragment,
});
