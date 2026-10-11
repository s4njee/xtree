import type { ChunkMap } from '../../glsl/index.js';
import shapes from './shapes.glsl';

/** Signed distance chunks, keyed by include id. */
export const sdf = {
  'xtree/sdf/shapes': shapes,
} as const satisfies ChunkMap;
