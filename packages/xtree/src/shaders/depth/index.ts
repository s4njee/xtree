import type { ChunkMap } from '../../glsl/index.js';
import reconstruct from './reconstruct.glsl';

/** Depth buffer chunks, keyed by include id. */
export const depth = {
  'xtree/depth/reconstruct': reconstruct,
} as const satisfies ChunkMap;
