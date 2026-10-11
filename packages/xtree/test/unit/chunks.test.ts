import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveIncludes } from '../../src/glsl/index.js';
import {
  blend,
  blendModes,
  chunks,
  color,
  depth,
  noise,
} from '../../src/shaders/index.js';

const shaderDir = new URL('../../src/shaders/', import.meta.url);
const families = { noise, color, blend, depth } as const;

describe('chunk registry', () => {
  for (const [family, map] of Object.entries(families)) {
    it(`registers every ${family} chunk file under its path id`, () => {
      const files = readdirSync(new URL(`${family}/`, shaderDir))
        .filter((file) => file.endsWith('.glsl'))
        .map((file) => `xtree/${family}/${file.replace(/\.glsl$/, '')}`)
        .sort();
      expect(Object.keys(map).sort()).toEqual(files);
    });
  }

  it('combines every family in `chunks`', () => {
    expect(Object.keys(chunks).sort()).toEqual(
      [
        ...Object.keys(noise),
        ...Object.keys(color),
        ...Object.keys(blend),
        ...Object.keys(depth),
      ].sort(),
    );
  });

  for (const id of Object.keys(chunks)) {
    it(`resolves ${id} on its own`, () => {
      const { code } = resolveIncludes(`#include <${id}>`, chunks);
      expect(code).not.toMatch(/#include/);
    });
  }

  it('keeps blendModes in sync with the XT_BLEND_* defines', () => {
    const defines = Object.fromEntries(
      [
        ...blend['xtree/blend/modes'].matchAll(/#define XT_BLEND_(\w+) (\d+)/g),
      ].map(([, name, value]) => [
        name!
          .toLowerCase()
          .replace(/_(\w)/g, (_, c: string) => c.toUpperCase()),
        Number(value),
      ]),
    );
    expect(defines).toEqual(blendModes);
  });
});
