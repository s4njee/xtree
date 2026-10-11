import { color, defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Print-style halftone: CMYK, single-ink or RGB screens of dots, lines or squares. */
export const halftone = defineEffect({
  name: 'halftone',
  meta: {
    title: 'Halftone',
    family: 'retro',
    story: 'X8.2',
    description:
      'Print-style halftone screens: four rotated CMYK screens, a single ink, or additive RGB, drawn as dots, lines or squares sized by the tone under each cell.',
    related: ['dither', 'pixelate', 'ascii'],
  },
  sampling: 'input',
  chunks: [colorSpaceChunks],
  params: {
    mode: select({
      options: ['cmyk', 'mono', 'rgb'],
      default: 'cmyk',
      description:
        'Four subtractive screens, one ink on paper, or three additive screens on black.',
      optionLabels: { cmyk: 'CMYK', rgb: 'RGB' },
    }),
    shape: select({
      options: ['dot', 'line', 'square'],
      default: 'dot',
      description: 'Shape of each screen element.',
    }),
    scale: float({
      default: 8,
      min: 2,
      max: 48,
      step: 0.5,
      unit: 'px',
      description: 'Screen period: the distance between neighbouring elements.',
    }),
    angle: float({
      default: 0,
      min: -90,
      max: 90,
      step: 1,
      unit: '°',
      description:
        'Rotates every screen. CMYK screens keep their 15°, 75°, 0° and 45° offsets.',
    }),
    softness: float({
      default: 1,
      min: 0.25,
      max: 4,
      step: 0.05,
      unit: 'px',
      description: 'Width of the antialiased edge.',
    }),
    ink: color({ default: '#1a1a1a', description: 'Mono: ink color.' }),
    paper: color({
      default: '#f4efe4',
      description: 'Paper color for CMYK and mono.',
    }),
  },
  presets: {
    newsprint: { mode: 'mono', scale: 6, angle: 45 },
    comic: { mode: 'cmyk', scale: 12 },
    lines: { mode: 'mono', shape: 'line', scale: 7, angle: 30 },
    screen: { mode: 'rgb', shape: 'square', scale: 5 },
  },
  fragment,
});
