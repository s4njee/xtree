import type { ChunkMap } from '../../glsl/index.js';
import luminance from './luminance.glsl';
import space from './space.glsl';
import spectral from './spectral.glsl';
import tonemap from './tonemap.glsl';
import whiteBalance from './white-balance.glsl';

/** Color science chunks, keyed by include id. */
export const color = {
  'xtree/color/luminance': luminance,
  'xtree/color/space': space,
  'xtree/color/white-balance': whiteBalance,
  'xtree/color/spectral': spectral,
  'xtree/color/tonemap': tonemap,
} as const satisfies ChunkMap;
