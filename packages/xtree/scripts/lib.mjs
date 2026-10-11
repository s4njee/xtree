// Helpers shared by the package scripts.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

export const packageRoot = fileURLToPath(new URL('..', import.meta.url));
export const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
export const shaderRoot = `${packageRoot}src/shaders/`;

/** Chunk families in documentation order. */
export const families = [
  {
    id: 'noise',
    title: 'Noise',
    order: [
      'hash',
      'gradient',
      'value',
      'perlin',
      'simplex',
      'worley',
      'fbm',
      'curl',
      'blue',
    ],
  },
  {
    id: 'color',
    title: 'Color',
    order: ['luminance', 'space', 'white-balance', 'tonemap'],
  },
  { id: 'blend', title: 'Blend', order: ['modes'] },
];

const rank = (order, file) => {
  const index = order.indexOf(file.replace(/\.glsl$/, ''));
  return index === -1 ? order.length : index;
};

/** Reads every chunk file from disk: [{ id, family, file, source }]. */
export function readChunks() {
  return families.flatMap(({ id: family, order }) =>
    readdirSync(`${shaderRoot}${family}`)
      .filter((file) => file.endsWith('.glsl'))
      .sort((a, b) => rank(order, a) - rank(order, b) || a.localeCompare(b))
      .map((file) => ({
        id: `xtree/${family}/${file.replace(/\.glsl$/, '')}`,
        family,
        file: `src/shaders/${family}/${file}`,
        source: readFileSync(`${shaderRoot}${family}/${file}`, 'utf8'),
      })),
  );
}

/** Effect folders under src/effects, sorted. */
export function readEffectIds() {
  return readdirSync(`${packageRoot}src/effects`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Loads a TypeScript module from source, with `.glsl` imports. */
export async function loadSource(path) {
  const { module: pluginModule } = await runnerImport(
    `${packageRoot}build/glsl-plugin.ts`,
    {
      root: packageRoot,
      configFile: false,
      logLevel: 'silent',
    },
  );
  const { module } = await runnerImport(`${packageRoot}${path}`, {
    root: packageRoot,
    configFile: false,
    logLevel: 'silent',
    plugins: [pluginModule.glsl({ minify: false })],
    define: { __XTREE_VERSION__: JSON.stringify('0.0.0-tools') },
  });
  return module;
}

/** Loads every effect factory: [{ id, factory }]. */
export async function loadEffects() {
  const effects = [];
  for (const id of readEffectIds()) {
    const module = await loadSource(`src/effects/${id}/index.ts`);
    const factory = Object.values(module).find(
      (value) => typeof value === 'function' && value.definition,
    );
    if (!factory)
      throw new Error(`src/effects/${id}/index.ts exports no effect factory`);
    if (factory.definition.name !== id)
      throw new Error(
        `src/effects/${id} defines "${factory.definition.name}"; the folder and name must match`,
      );
    effects.push({ id, factory });
  }
  return effects;
}

/** Loads the TypeScript GLSL utilities from source. */
export async function loadGlslTools() {
  const { module } = await runnerImport(`${packageRoot}src/glsl/index.ts`, {
    root: packageRoot,
    configFile: false,
    logLevel: 'silent',
  });
  return module;
}

/** Parses a chunk into its header description, includes, defines and documented functions. */
export function parseChunk(source) {
  const header = /^\/\*\*([\s\S]*?)\*\//.exec(source);
  const description = header
    ? header[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ')
    : '';
  const lines = source.split('\n');
  const includes = [...source.matchAll(/^#include <([^>]+)>/gm)].map(
    (m) => m[1],
  );
  const defines = [...source.matchAll(/^#define (\w+)(?:\s+(.*))?$/gm)].map(
    (m) => ({
      name: m[1],
      value: (m[2] ?? '').trim(),
    }),
  );
  const functions = [];
  let doc = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('///')) {
      doc.push(line.replace(/^\/\/\/\s?/, ''));
      continue;
    }
    const match =
      /^(?:(?:highp|mediump|lowp)\s+)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{\s*$/.exec(
        line,
      );
    if (match) {
      functions.push({
        name: match[2],
        returns: match[1],
        signature: line.replace(/\s*\{\s*$/, ''),
        doc: doc.join(' '),
        line: i + 1,
      });
    }
    if (line.trim() !== '') doc = [];
  }
  return { description, includes, defines, functions };
}
