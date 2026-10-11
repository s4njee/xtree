import { defineEffect, float, select } from '../../effect/index.js';
import fragment from './shader.glsl';

/** A painterly smoothing filter that keeps edges. */
export const kuwahara = defineEffect({
  name: 'kuwahara',
  meta: {
    title: 'Kuwahara (painterly)',
    family: 'stylize',
    story: 'X8.6',
    description:
      'An edge-preserving smoothing filter that turns detail into flat, brushy patches, like an oil painting: each pixel takes the calmest neighboring region’s average.',
    related: ['watercolor', 'posterize', 'mosaic'],
  },
  sampling: 'input',
  params: {
    radius: float({
      default: 4,
      min: 1,
      max: 8,
      step: 1,
      unit: 'px',
      description:
        'Size of the regions; larger makes bigger strokes and costs more.',
    }),
    sectors: select({
      options: ['four', 'eight'],
      default: 'eight',
      structural: true,
      description:
        'Four square quadrants (classic, blockier) or eight soft sectors (smoother strokes).',
      optionLabels: { four: '4 quadrants', eight: '8 sectors' },
    }),
  },
  presets: {
    oil: { radius: 6 },
    classic: { sectors: 'four', radius: 5 },
    subtle: { radius: 2 },
    heavy: { radius: 8 },
  },
  fragment,
});
