import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from './test.js';
import { variantsFile } from './global-setup.js';
import { chunks, compileAndRun, runShader } from './harness.js';

test.describe('chunk compilation', () => {
  for (const id of Object.keys(chunks)) {
    test(`${id} compiles on its own`, async ({ page }) => {
      const output = await runShader(page, {
        source: `#include <${id}>\nvec4 xt_test(vec4 value, int index) { return value; }`,
        inputs: [1, 2, 3, 4],
      });
      expect(output).toEqual([1, 2, 3, 4]);
    });
  }

  test('every chunk compiles together in one shader', async ({ page }) => {
    const includes = Object.keys(chunks)
      .map((id) => `#include <${id}>`)
      .join('\n');
    const output = await runShader(page, {
      source: `${includes}\nvec4 xt_test(vec4 value, int index) { return value * 2.0; }`,
      inputs: [1, 2, 3, 4],
    });
    expect(output).toEqual([2, 4, 6, 8]);
  });
});

test.describe('compile error mapping', () => {
  test('reports errors in the root source as test:<line>', async ({ page }) => {
    const result = await compileAndRun(page, {
      source:
        '#include <xtree/noise/value>\n\nvec4 xt_test(vec4 value, int index) {\n  return vec4(missingName);\n}',
      inputs: [0, 0, 0, 0],
    });
    expect(result.error).toMatch(/ERROR: test:4: .*missingName/);
  });

  test('reports errors inside a chunk as <chunk id>:<line>', async ({
    page,
  }) => {
    const result = await compileAndRun(page, {
      source:
        '#include <xtree/test/broken>\nvec4 xt_test(vec4 value, int index) { return value; }',
      inputs: [0, 0, 0, 0],
      chunks: {
        'xtree/test/broken':
          '#include <xtree/noise/hash>\n\nfloat xt_broken() {\n  return brokenName;\n}\n',
      },
    });
    expect(result.error).toMatch(/ERROR: xtree\/test\/broken:4: .*brokenName/);
  });
});

interface Variant {
  readonly name: string;
  readonly stage: 'vert' | 'frag';
  readonly source: string;
}

// X18.2: every effect, preset, structural variant and mask kind that the GLSL
// lint generates, compiled by this browser's own GLSL compiler. Shaders with
// the same name (a material's vertex and fragment) are also linked.
test.describe('effect variants compile in this browser', () => {
  const effects = readdirSync(new URL('../../src/effects/', import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let variants: Variant[] = [];
  test.beforeAll(() => {
    variants = JSON.parse(readFileSync(variantsFile, 'utf8')) as Variant[];
  });

  test('the lint emitted variants for every effect', () => {
    for (const id of effects)
      expect(
        variants.some((v) => v.name.startsWith(`${id} `)),
        id,
      ).toBe(true);
  });

  for (const id of effects) {
    test(id, async ({ page }) => {
      const mine = variants.filter((v) => v.name.startsWith(`${id} `));
      const failures = await page.evaluate(compileAll, mine);
      expect(failures).toEqual([]);
    });
  }
});

/** Runs in the page: compiles (and links, where both stages exist) each named shader group. */
function compileAll(variants: Variant[]): string[] {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return ['WebGL2 is unavailable'];
  const failures: string[] = [];
  const groups = new Map<string, Variant[]>();
  for (const v of variants)
    groups.set(v.name, [...(groups.get(v.name) ?? []), v]);
  try {
    for (const [name, group] of groups) {
      const shaders: WebGLShader[] = [];
      let ok = true;
      for (const { stage, source } of group) {
        const shader = gl.createShader(
          stage === 'vert' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER,
        )!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          failures.push(`${name} ${stage}: ${gl.getShaderInfoLog(shader)}`);
          ok = false;
        }
        shaders.push(shader);
      }
      if (ok && group.length > 1) {
        const program = gl.createProgram()!;
        for (const shader of shaders) gl.attachShader(program, shader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          failures.push(`${name} link: ${gl.getProgramInfoLog(program)}`);
        gl.deleteProgram(program);
      }
      for (const shader of shaders) gl.deleteShader(shader);
    }
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return failures;
}
