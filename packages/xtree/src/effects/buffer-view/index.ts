import { defineEffect, float, select } from '../../effect/index.js';
import { colorSpaceChunks } from '../../shaders/maps.js';
import fragment from './shader.glsl';

/** Shows a geometry buffer or the effect's mask, for debugging depth, normal and selection effects. */
export const bufferView = defineEffect({
  name: 'buffer-view',
  meta: {
    title: 'Buffer view',
    family: 'utility',
    story: 'X1.6',
    description:
      'Shows a geometry buffer instead of the image: distance from the camera, view-space normals from the prepass or reconstructed from depth, world position, or the mask given to this effect. Set the renderer to no tone mapping to see exact values.',
    related: ['outline', 'depth-fog', 'depth-of-field'],
  },
  buffers: (effect) =>
    effect.buffer === 'normal'
      ? ['normal']
      : effect.buffer === 'mask'
        ? []
        : ['depth'],
  // It shows the mask rather than being limited by it.
  masking: 'custom',
  chunks: [colorSpaceChunks],
  params: {
    buffer: select({
      options: ['depth', 'normal', 'reconstructedNormal', 'position', 'mask'],
      default: 'depth',
      structural: true,
      description: 'What to show. Only the buffer shown is rendered.',
      optionLabels: { reconstructedNormal: 'Normal from depth' },
    }),
    range: float({
      default: 20,
      min: 0.5,
      max: 200,
      step: 0.5,
      description:
        'Depth: distance shown as white. Position: world coordinates from -range to +range map to 0–1 per channel.',
    }),
  },
  presets: {
    normals: { buffer: 'normal' },
    fromDepth: { buffer: 'reconstructedNormal' },
    position: { buffer: 'position' },
  },
  fragment,
});
