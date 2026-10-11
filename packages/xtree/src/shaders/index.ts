import type { ChunkMap } from '../glsl/index.js';
import { blend } from './blend/index.js';
import { color } from './color/index.js';
import { depth } from './depth/index.js';
import { noise } from './noise/index.js';

export { blend, blendModes, type BlendMode } from './blend/index.js';
export { color } from './color/index.js';
export { depth } from './depth/index.js';
export { noise } from './noise/index.js';

/** Every built-in chunk. Import a family entry instead to ship less GLSL. */
export const chunks: ChunkMap = { ...noise, ...color, ...blend, ...depth };
export * from './maps.js';
