/**
 * The root entry, `@mk7s/xtree`: the installed version and the GLSL include tools.
 *
 * @module xtree
 */
/** The installed version of @mk7s/xtree. */
export const version: string = __XTREE_VERSION__;

export {
  formatShaderError,
  minifyGlsl,
  resolveIncludes,
  ShaderIncludeError,
  type ChunkMap,
  type ResolvedShader,
  type ResolveOptions,
} from './glsl/index.js';
