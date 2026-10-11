import { bool, defineEffect, float } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Broadcast teletext: block mosaics in eight colors on a coarse grid. */
export const teletext = defineEffect({
  name: 'teletext',
  meta: {
    title: 'Teletext',
    family: 'retro',
    story: 'X7.9',
    description:
      'Rebuilds the image from teletext block graphics: a 40×25 grid of cells, each a 2×3 mosaic in two of eight broadcast colors, or 1-bit white on black.',
    related: ['ascii', 'pixelate', 'palette'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    columns: float({
      default: 40,
      min: 10,
      max: 160,
      step: 1,
      description: 'Character cells across the screen (teletext has 40).',
    }),
    rows: float({
      default: 25,
      min: 6,
      max: 100,
      step: 1,
      description: 'Character rows down the screen (teletext has 25).',
    }),
    mono: bool({
      default: false,
      description: '1-bit: white sixels on black.',
    }),
    threshold: float({
      default: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      description: '1-bit: brightness above which a sixel is lit.',
    }),
    separated: bool({
      default: false,
      description: 'Separated graphics, with gaps between sixels.',
    }),
  },
  presets: {
    ceefax: { columns: 40, rows: 25, separated: false },
    oneBit: { mono: true, columns: 80, rows: 50 },
    separated: { separated: true },
    fine: { columns: 80, rows: 50 },
  },
  fragment,
});
