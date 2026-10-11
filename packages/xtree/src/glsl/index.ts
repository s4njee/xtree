/**
 * GLSL source utilities: `#include` resolution against chunk maps, compile
 * error mapping, and line-preserving minification.
 *
 * @module glsl
 */

/** GLSL chunk sources keyed by include id, for example `xtree/noise/simplex`. */
export type ChunkMap = Readonly<Record<string, string>>;

/** Options for `resolveIncludes`. */
export interface ResolveOptions {
  /** Name reported for the root source in compile errors. Defaults to `shader`. */
  readonly name?: string;
  /**
   * Insert `#line` directives so compile errors report chunk-relative line
   * numbers. Defaults to `true`. The root source must not put `#include`
   * before `#version`.
   */
  readonly lineDirectives?: boolean;
}

/** GLSL with every include expanded, and the files its line numbers map back to. */
export interface ResolvedShader {
  /** Source with every xtree include expanded once. */
  readonly code: string;
  /**
   * Source-string table: index 0 is the root name, then each included chunk
   * in inclusion order. Pass it to {@link formatShaderError}.
   */
  readonly files: readonly string[];
}

/** Thrown for an unknown xtree chunk or an include cycle. */
export class ShaderIncludeError extends Error {
  override readonly name = 'ShaderIncludeError';
}

const includePattern =
  /^[ \t]*#[ \t]*include[ \t]+<([^>\s]+)>[ \t]*(?:\/\/.*)?$/;

/** Chunk ids in this namespace must resolve; other includes (such as three.js's `<common>`) are left for three.js. */
const reservedPrefix = 'xtree/';

/**
 * Expands `#include <id>` lines whose id appears in `chunks`. Each chunk is
 * included at most once per resolved shader (at its first include), so
 * shaders and chunks can declare their dependencies freely. Includes that
 * name no known chunk and don't start with `xtree/` are left unchanged, so
 * three.js can resolve its own chunks later.
 */
export function resolveIncludes(
  source: string,
  chunks: ChunkMap | readonly ChunkMap[],
  options: ResolveOptions = {},
): ResolvedShader {
  const maps: readonly ChunkMap[] = Array.isArray(chunks)
    ? (chunks as readonly ChunkMap[])
    : [chunks as ChunkMap];
  const lookup = (id: string): string | undefined => {
    for (let i = maps.length - 1; i >= 0; i--) {
      const map = maps[i]!;
      if (Object.hasOwn(map, id)) return map[id];
    }
    return undefined;
  };
  const lineDirectives = options.lineDirectives ?? true;
  const files: string[] = [options.name ?? 'shader'];
  const included = new Set<string>();

  const expand = (
    text: string,
    fileIndex: number,
    stack: readonly string[],
  ): string => {
    const lines = text.split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = includePattern.exec(line);
      const id = match?.[1];
      if (id === undefined) {
        out.push(line);
        continue;
      }
      const chunk = lookup(id);
      if (chunk === undefined) {
        if (id.startsWith(reservedPrefix)) {
          throw new ShaderIncludeError(
            `${files[fileIndex]}:${i + 1}: unknown chunk <${id}>`,
          );
        }
        out.push(line);
        continue;
      }
      if (stack.includes(id)) {
        throw new ShaderIncludeError(
          `include cycle: ${[...stack, id].join(' -> ')}`,
        );
      }
      if (included.has(id)) {
        // Keep the line count stable for error mapping.
        out.push('');
        continue;
      }
      included.add(id);
      const index = files.push(id) - 1;
      if (lineDirectives) out.push(`#line 1 ${index}`);
      out.push(expand(chunk.replace(/\n$/, ''), index, [...stack, id]));
      if (lineDirectives) out.push(`#line ${i + 2} ${fileIndex}`);
    }
    return out.join('\n');
  };

  const rootName = files[0]!;
  return { code: expand(source, 0, [rootName]), files };
}

const diagnosticPattern = /^(ERROR|WARNING): (\d+):(\d+): ?(.*)$/;

/**
 * Rewrites a WebGL info log so each `ERROR: <source>:<line>:` names the chunk
 * from {@link ResolvedShader.files}, for example
 * `ERROR: xtree/noise/simplex:12: 'foo' : undeclared identifier`.
 */
export function formatShaderError(
  log: string,
  files: readonly string[],
): string {
  return log
    .split('\n')
    .map((line) => {
      const match = diagnosticPattern.exec(line.trim());
      if (!match) return line;
      const [, kind, source, row, message] = match;
      const file = files[Number(source)] ?? `source ${source}`;
      return `${kind}: ${file}:${row}: ${message}`;
    })
    .join('\n');
}

/**
 * Line-preserving GLSL minification: strips comments, indentation and
 * trailing whitespace, and collapses runs of spaces. Line numbers don't
 * change, so `#line` mapping and driver errors stay correct. Macro
 * definitions keep the space that tells function-like from object-like
 * macros apart.
 */
export function minifyGlsl(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ''),
  );
  return withoutBlocks
    .split('\n')
    .map((line) =>
      line
        .replace(/\/\/.*$/, '')
        .trim()
        .replace(/[ \t]+/g, ' '),
    )
    .join('\n')
    .replace(/\n+$/, '\n');
}
