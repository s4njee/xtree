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
