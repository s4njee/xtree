/**
 * `@mk7s/xtree/shaders`: the GLSL chunk maps to pass to `resolveIncludes` or an effect's `chunks`.
 *
 * @module shaders
 */
import type { ChunkMap } from '../glsl/index.js';
import { blend } from './blend/index.js';
import { color } from './color/index.js';
import { depth } from './depth/index.js';
import { dither } from './dither/index.js';
import { sampling } from './sampling/index.js';
import { sdf } from './sdf/index.js';
import { noise } from './noise/index.js';

export { blend, blendModes, type BlendMode } from './blend/index.js';
export { color } from './color/index.js';
export { depth } from './depth/index.js';
export { dither } from './dither/index.js';
export { sampling } from './sampling/index.js';
export { sdf } from './sdf/index.js';
export { noise } from './noise/index.js';

/** Every built-in chunk. Import a family entry instead to ship less GLSL. */
export const chunks: ChunkMap = {
  ...noise,
  ...color,
  ...blend,
  ...depth,
  ...sampling,
  ...sdf,
  ...dither,
};
export * from './maps.js';
