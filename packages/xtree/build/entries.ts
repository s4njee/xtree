import { readdirSync } from 'node:fs';

/** Fixed library entry points: output name (without .js) to source file. */
const fixed = {
  index: 'src/index.ts',
  'glsl/index': 'src/glsl/index.ts',
  'shaders/index': 'src/shaders/index.ts',
  'shaders/noise/index': 'src/shaders/noise/index.ts',
  'shaders/color/index': 'src/shaders/color/index.ts',
  'shaders/blend/index': 'src/shaders/blend/index.ts',
  'effect/index': 'src/effect/index.ts',
  'core/index': 'src/core/index.ts',
} as const;

/** Every folder in src/effects is an entry, `@mk7s/xtree/effects/<id>`. */
const effects = Object.fromEntries(
  readdirSync(new URL('../src/effects/', import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [
      `effects/${entry.name}/index`,
      `src/effects/${entry.name}/index.ts`,
    ]),
);

/** Keep package.json "exports" in sync with `pnpm exports`. */
export const entries: Record<string, string> = { ...fixed, ...effects };
