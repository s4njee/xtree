import { defineEffect, float, int, select } from '../../effect/index.js';
import { samplingSpiralChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Lens-shaped blur of the whole frame, without depth. */
export const bokehBlur = defineEffect({
  name: 'bokeh-blur',
  meta: {
    title: 'Bokeh blur',
    family: 'glow',
    story: 'X5.7',
    description:
      'Blurs the whole frame through a round or hexagonal aperture, so highlights turn into soft discs or hexagons. For focus by distance, use depth of field.',
    related: ['depth-of-field', 'blur', 'bloom'],
  },
  sampling: 'input',
  chunks: [samplingSpiralChunks],
  params: {
    radius: float({
      default: 8,
      min: 0,
      max: 40,
      step: 0.5,
      unit: 'px',
      description: 'Radius of the aperture shape.',
    }),
    shape: select({
      options: ['circle', 'hexagon'],
      default: 'circle',
      structural: true,
      description: 'Aperture shape.',
    }),
    highlights: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description:
        'Extra weight for bright samples, which makes highlight shapes stand out.',
    }),
    samples: int({
      default: 48,
      min: 8,
      max: 128,
      step: 1,
      description: 'Samples per pixel; more give smoother shapes.',
    }),
  },
  quality: { low: { samples: 16 }, medium: { samples: 32 } },
  presets: {
    dreamy: { radius: 14, highlights: 2 },
    hexagon: { shape: 'hexagon', radius: 12, highlights: 2.5 },
    soft: { radius: 5, highlights: 0.5, samples: 32 },
    heavy: { radius: 28, samples: 96 },
  },
  fragment,
});
