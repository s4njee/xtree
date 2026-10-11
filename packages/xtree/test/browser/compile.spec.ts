import { expect, test } from '@playwright/test';
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
