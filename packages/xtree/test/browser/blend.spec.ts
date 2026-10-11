import { expect, test } from './test.js';
import { blendModes } from '../../src/shaders/blend/constants.js';
import { random, runShader, vec4s } from './harness.js';
import { blendReference, type Vec3 } from './reference.js';

function pairs(): [Vec3, Vec3][] {
  const edges = [0, 0.25, 0.5, 0.75, 1];
  const list: [Vec3, Vec3][] = [];
  for (const b of edges)
    for (const s of edges)
      list.push([
        [b, s, 1 - b],
        [s, b, 1 - s],
      ]);
  const next = random(42);
  for (let i = 0; i < 1500; i++) {
    list.push([
      [next(), next(), next()],
      [next(), next(), next()],
    ]);
  }
  return list.map(([b, s]) => [
    b.map(Math.fround) as Vec3,
    s.map(Math.fround) as Vec3,
  ]);
}

test.describe('blend modes', () => {
  const list = pairs();
  for (const [mode, value] of Object.entries(blendModes)) {
    test(`${mode} (${value}) matches the reference`, async ({ page }) => {
      const out = vec4s(
        await runShader(page, {
          source: `#include <xtree/blend/modes>
vec4 xt_test(vec4 v, int index) {
  int pair = index / 2;
  vec3 base = texelFetch(xt_aux, ivec2(pair * 2, 0), 0).rgb;
  vec3 blend = texelFetch(xt_aux, ivec2(pair * 2 + 1, 0), 0).rgb;
  return index % 2 == 0 ? vec4(xt_blend(${value}, base, blend), 0.0) : vec4(xt_blend(${value}, base, blend, 0.25), 0.0);
}`,
          inputs: new Array(list.length * 2 * 4).fill(0),
          aux: {
            width: list.length * 2,
            height: 1,
            data: list.flatMap(([b, s]) => [...b, 0, ...s, 0]),
          },
        }),
      );
      list.forEach(([base, blend], i) => {
        const expected = blendReference(mode, base, blend);
        const full = out[i * 2]!;
        const quarter = out[i * 2 + 1]!;
        for (let c = 0; c < 3; c++) {
          expect(
            Math.abs(full[c]! - expected[c]!),
            `${mode} base=${base} blend=${blend}`,
          ).toBeLessThan(1e-4);
          const mixed = base[c]! + (expected[c]! - base[c]!) * 0.25;
          expect(Math.abs(quarter[c]! - mixed)).toBeLessThan(1e-4);
        }
      });
    });
  }

  test('unknown modes return the blend color', async ({ page }) => {
    const out = await runShader(page, {
      source: `#include <xtree/blend/modes>
vec4 xt_test(vec4 v, int index) { return vec4(xt_blend(99, vec3(0.1), v.rgb), 0.0); }`,
      inputs: [0.3, 0.6, 0.9, 0],
    });
    expect(out.slice(0, 3).map((v) => Number(v.toFixed(6)))).toEqual([
      0.3, 0.6, 0.9,
    ]);
  });
});
