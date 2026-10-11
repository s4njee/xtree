import type { ChunkMap } from '../../glsl/index.js';
import bicubic from './bicubic.glsl';
import pyramid from './pyramid.glsl';
import spiral from './spiral.glsl';

/** Sampling filter chunks, keyed by include id. */
export const sampling = {
  'xtree/sampling/spiral': spiral,
  'xtree/sampling/pyramid': pyramid,
  'xtree/sampling/bicubic': bicubic,
} as const satisfies ChunkMap;
