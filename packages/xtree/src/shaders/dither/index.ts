import type { ChunkMap } from '../../glsl/index.js';
import ordered from './ordered.glsl';

/** Dithering chunks, keyed by include id. */
export const dither = {
  'xtree/dither/ordered': ordered,
} as const satisfies ChunkMap;
