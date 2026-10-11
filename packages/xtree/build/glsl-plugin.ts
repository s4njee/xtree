import type { Plugin } from 'vite';
import { minifyGlsl } from '../src/glsl/index.js';

/**
 * Loads `.glsl` files as default-exported strings. Includes are kept as they
 * are and resolved at runtime by `resolveIncludes`, so merged effects can
 * share chunks. In production the source is minified without changing line
 * numbers.
 */
export function glsl(options: { minify: boolean }): Plugin {
  return {
    name: 'xtree-glsl',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?', 1)[0]!.endsWith('.glsl')) return null;
      const source = options.minify ? minifyGlsl(code) : code;
      return { code: `export default ${JSON.stringify(source)};`, map: null };
    },
  };
}
