import type { ChunkMap } from '../../glsl/index.js';
import blue from './blue.glsl';
import curl from './curl.glsl';
import fbm from './fbm.glsl';
import gradient from './gradient.glsl';
import hash from './hash.glsl';
import perlin from './perlin.glsl';
import simplex from './simplex.glsl';
import value from './value.glsl';
import worley from './worley.glsl';

/** Hash and noise chunks, keyed by include id. */
export const noise = {
  'xtree/noise/hash': hash,
  'xtree/noise/gradient': gradient,
  'xtree/noise/value': value,
  'xtree/noise/perlin': perlin,
  'xtree/noise/simplex': simplex,
  'xtree/noise/worley': worley,
  'xtree/noise/fbm': fbm,
  'xtree/noise/curl': curl,
  'xtree/noise/blue': blue,
} as const satisfies ChunkMap;
