import { defineEffect, select } from '../../effect/index.js';
import { bloomChain } from '../bloom/chain.js';
import fragment from '../bloom/composite.glsl';
import { bloom } from '../bloom/index.js';

/** Bloom limited to selected objects (or a mask texture), so only they glow. */
export const selectiveBloom = defineEffect({
  name: 'selective-bloom',
  meta: {
    title: 'Selective bloom',
    family: 'glow',
    story: 'X5.3',
    description:
      'Bloom from selected objects only: give it a selection or texture mask and just those pixels feed the glow, which still spreads over everything around them. Without a mask it is ordinary bloom.',
    related: ['bloom', 'glow', 'outline'],
    demo: { selection: ['knot', 'gem'] },
  },
  sampling: 'input',
  masking: 'custom',
  params: {
    ...bloom.definition.params,
    luminance: select({
      options: ['threshold', 'all'],
      default: 'all',
      description:
        'Masked pixels bloom above the threshold, or all of them whatever their brightness.',
    }),
  },
  presets: {
    neon: { intensity: 2, radius: 0.55, knee: 0.2 },
    halo: { intensity: 1.2, radius: 0.9, levels: 8 },
    hotspots: { luminance: 'threshold', threshold: 0.8, intensity: 1.5 },
    tinted: { tint: '#7cc4ff', intensity: 1.6 },
  },
  textures: ['bloom'],
  fragment,
  setup(context) {
    return bloomChain(context as never, true);
  },
});
