import { defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Two film-lab looks: bleach bypass and cross processing. */
export const bleachBypass = defineEffect({
  name: 'bleach-bypass',
  meta: {
    title: 'Bleach bypass & cross process',
    family: 'color',
    story: 'X3.15',
    description:
      'Two film-lab looks: bleach bypass (silver left in, so a muted, harsh, high-contrast image) and cross processing (slide film in negative chemistry, with skewed colors and yellow highlights).',
    related: ['curves', 'film-grain', 'split-toning'],
  },
  chunks: [colorSpaceChunks],
  params: {
    mode: select({
      options: ['bleach', 'cross'],
      default: 'bleach',
      structural: true,
      description: 'Which process to imitate.',
      optionLabels: { bleach: 'Bleach bypass', cross: 'Cross process' },
    }),
    amount: float({
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Strength of the look.',
    }),
  },
  presets: {
    gritty: { mode: 'bleach', amount: 1 },
    subtleBleach: { mode: 'bleach', amount: 0.45 },
    crossProcess: { mode: 'cross', amount: 0.85 },
    lomo: { mode: 'cross', amount: 1 },
  },
  fragment,
});
