import type { ChunkMap } from '../../glsl/index.js';
import modes from './modes.glsl';

/** Blend mode chunks, keyed by include id. */
export const blend = {
  'xtree/blend/modes': modes,
} as const satisfies ChunkMap;

export { blendModes, type BlendMode } from './constants.js';
