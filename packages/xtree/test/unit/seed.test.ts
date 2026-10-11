import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// X14.7: every effect whose look comes from noise takes a `seed`. Effects
// that use noise only to jitter samples (hidden by the blur it feeds) are
// deterministic already and listed here.
const jitterOnly = new Set([
  'directional-blur',
  'god-rays',
  'motion-blur',
  'radial-blur',
]);
const noise =
  /\b(xt_hash[1-4]|xt_simplex|xt_fbm|xt_valueNoise|xt_worley|xt_perlin)\(/;

describe('seeds (X14.7)', () => {
  const root = new URL('../../src/effects/', import.meta.url);
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('every effect with a random pattern has a seed parameter it uses', () => {
    const missing: string[] = [];
    for (const id of ids) {
      if (jitterOnly.has(id)) continue;
      const folder = new URL(`${id}/`, root);
      const glsl = readdirSync(folder)
        .filter((file) => file.endsWith('.glsl'))
        .map((file) => readFileSync(new URL(file, folder), 'utf8'))
        .join('\n');
      if (!noise.test(glsl)) continue;
      const source = readFileSync(new URL('index.ts', folder), 'utf8');
      if (!/\bseed:/.test(source) || !/xt_seeded\(|\$seed\b/.test(glsl))
        missing.push(id);
    }
    expect(missing).toEqual([]);
  });
});
