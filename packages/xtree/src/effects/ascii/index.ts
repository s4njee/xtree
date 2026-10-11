import {
  bool,
  color,
  defineEffect,
  float,
  select,
  texture,
} from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import { fontCharacters, fontTexels, tileHeight, tileWidth } from './font.js';
import fragment from './shader.glsl';

export { fontCharacters, fontTexels, tileHeight, tileWidth } from './font.js';

/** Redraws the image as text: each cell becomes the character whose ink best matches its brightness. */
export const ascii = defineEffect({
  name: 'ascii',
  meta: {
    title: 'ASCII',
    family: 'retro',
    story: 'X8.3',
    description:
      'Redraws the image as text: each cell becomes the character whose ink matches its brightness, in the original colors or in two theme colors.',
    related: ['pixelate', 'halftone', 'dither'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    cellSize: float({
      default: 8,
      min: 4,
      max: 32,
      step: 1,
      unit: 'px',
      description: 'Width of a character cell; cells are 4:3 tall.',
    }),
    charset: select({
      options: ['classic', 'binary', 'blocks', 'atlas'],
      default: 'classic',
      description:
        'Classic is the ramp " .:-=+*#%@", binary uses 1 and 0 (blank in the dark), blocks draws shaded blocks, atlas uses every tile of the font texture.',
    }),
    colorMode: select({
      options: ['original', 'mono'],
      default: 'original',
      description:
        'Draw characters in the colors underneath, or in the foreground color.',
    }),
    foreground: color({
      default: '#e8f0ff',
      description: 'Mono: character color.',
    }),
    background: color({
      default: '#05070c',
      description: 'Color behind the characters.',
    }),
    brightness: float({
      default: 1,
      min: 0.25,
      max: 3,
      step: 0.05,
      description: 'Gain before picking a character.',
    }),
    invert: bool({
      default: false,
      description:
        'Use dense characters for dark areas, for dark text on a light background.',
    }),
    font: texture({
      dimension: '2d',
      default: 'font5x7',
      description: `A strip of ${tileWidth}×${tileHeight}-texel glyph tiles ordered from least to most ink; the built-in one holds "${fontCharacters}".`,
      samples: {
        font5x7: () => ({
          kind: 'data2d',
          width: tileWidth * fontCharacters.length,
          height: tileHeight,
          data: fontTexels(),
          filter: 'nearest',
          wrap: 'clamp',
        }),
      },
    }),
  },
  presets: {
    terminal: {
      colorMode: 'mono',
      foreground: '#33ff66',
      background: '#020a04',
    },
    matrix: {
      charset: 'binary',
      colorMode: 'mono',
      foreground: '#5dff8a',
      background: '#000000',
      cellSize: 10,
    },
    blocks: { charset: 'blocks', cellSize: 6 },
    paper: {
      colorMode: 'mono',
      foreground: '#1b1b1b',
      background: '#f2eee3',
      invert: true,
    },
  },
  fragment,
});
