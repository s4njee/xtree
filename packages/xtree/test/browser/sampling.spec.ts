import { expect, test } from './test.js';
import { random, runShader, vec4s } from './harness.js';

test.describe('sampling chunk (X2.4)', () => {
  test('the spiral fills the unit disk evenly and Poisson points keep apart', async ({
    page,
  }) => {
    const n = 64;
    const inputs = Array.from({ length: n }, (_, i) => [i, 0, 0, 0]).flat();
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/sampling/spiral>
vec4 xt_test(vec4 v, int index) {
  return vec4(xt_spiral(int(v.x), ${n}), xt_poissonDisk(int(v.x)));
}`,
        inputs,
      }),
    );
    const radii = out.map(([x, y]) => Math.hypot(x!, y!));
    expect(Math.max(...radii)).toBeLessThanOrEqual(1);
    // The mean radius of a uniformly filled disk is 2/3.
    expect(radii.reduce((a, b) => a + b, 0) / n).toBeCloseTo(2 / 3, 1);
    const poisson = out.slice(0, 16).map((v) => [v[2]!, v[3]!]);
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++)
        expect(
          Math.hypot(
            poisson[i]![0]! - poisson[j]![0]!,
            poisson[i]![1]! - poisson[j]![1]!,
          ),
        ).toBeGreaterThan(0.3);
  });

  test('filters keep constants and linear ramps; Catmull-Rom hits texel values', async ({
    page,
  }) => {
    // A 32×32 texture whose red channel is a linear ramp in x and green is constant.
    const size = 32;
    const data: number[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) data.push((x + 0.5) / size, 0.25, 0, 1);
    const next = random(3);
    // Points well inside the texture, so the wide kernels don't reach the clamped edge.
    const inputs: number[] = [];
    for (let i = 0; i < 64; i++)
      inputs.push(0.3 + next() * 0.4, 0.3 + next() * 0.4, 0, 0);
    const texel = `vec2(1.0 / ${size}.0)`;
    const out = vec4s(
      await runShader(page, {
        aux: { width: size, height: size, data, filter: 'linear' },
        source: `#include <xtree/sampling/pyramid>
#include <xtree/sampling/bicubic>
vec4 xt_test(vec4 v, int index) {
  vec2 uv = v.xy;
  vec3 d = xt_downsample13(xt_aux, uv, ${texel});
  vec3 t = xt_upsampleTent9(xt_aux, uv, ${texel});
  vec3 k = xt_kawase(xt_aux, uv, ${texel}, 1.0);
  vec4 b = xt_textureBicubic(xt_aux, uv);
  vec4 c = xt_textureCatmullRom(xt_aux, uv);
  // Largest error against the ramp (red) and the constant (green), across all five.
  float ramp = max(max(abs(d.r - uv.x), abs(t.r - uv.x)), max(abs(k.r - uv.x), max(abs(b.r - uv.x), abs(c.r - uv.x))));
  float flat_ = max(max(abs(d.g - 0.25), abs(t.g - 0.25)), max(abs(k.g - 0.25), max(abs(b.g - 0.25), abs(c.g - 0.25))));
  // Catmull-Rom at the nearest texel center returns that texel exactly.
  vec2 center = (floor(uv * ${size}.0) + 0.5) / ${size}.0;
  float hit = abs(xt_textureCatmullRom(xt_aux, center).r - center.x);
  return vec4(ramp, flat_, hit, 0.0);
}`,
        inputs,
      }),
    );
    for (const [ramp, flat, hit] of out) {
      expect(ramp).toBeLessThan(2e-3);
      expect(flat).toBeLessThan(1e-4);
      expect(hit).toBeLessThan(1e-4);
    }
  });
});

test.describe('signed distance chunk (X2.5)', () => {
  test('distances match the analytic shapes', async ({ page }) => {
    const next = random(9);
    const inputs: number[] = [];
    for (let i = 0; i < 256; i++)
      inputs.push(next() * 4 - 2, next() * 4 - 2, 0, 0);
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/sdf/shapes>
vec4 xt_test(vec4 v, int index) {
  vec2 p = v.xy;
  return vec4(xt_sdCircle(p, 0.8), xt_sdBox(p, vec2(0.6, 0.3)), xt_smin(xt_sdCircle(p, 0.5), xt_sdBox(p - 0.6, vec2(0.3)), 0.2), xt_sdSegment(p, vec2(-1.0, 0.0), vec2(1.0, 0.5)));
}`,
        inputs,
      }),
    );
    out.forEach(([circle, box, smooth, segment], i) => {
      const x = inputs[i * 4]!;
      const y = inputs[i * 4 + 1]!;
      expect(Math.abs(circle! - (Math.hypot(x, y) - 0.8))).toBeLessThan(1e-5);
      const dx = Math.abs(x) - 0.6;
      const dy = Math.abs(y) - 0.3;
      const boxRef =
        Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) +
        Math.min(Math.max(dx, dy), 0);
      expect(Math.abs(box! - boxRef)).toBeLessThan(1e-5);
      const a = Math.hypot(x, y) - 0.5;
      const bx = Math.abs(x - 0.6) - 0.3;
      const by = Math.abs(y - 0.6) - 0.3;
      const b =
        Math.hypot(Math.max(bx, 0), Math.max(by, 0)) +
        Math.min(Math.max(bx, by), 0);
      expect(smooth!).toBeLessThanOrEqual(Math.min(a, b) + 1e-5);
      expect(smooth!).toBeGreaterThanOrEqual(Math.min(a, b) - 0.05 - 1e-5);
      const t = Math.min(1, Math.max(0, ((x + 1) * 2 + y * 0.5) / 4.25));
      expect(
        Math.abs(segment! - Math.hypot(x + 1 - 2 * t, y - 0.5 * t)),
      ).toBeLessThan(1e-5);
    });
  });

  test('a hexagon has its inner radius along y and outer along x', async ({
    page,
  }) => {
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/sdf/shapes>
vec4 xt_test(vec4 v, int index) {
  return vec4(xt_sdHexagon(vec2(0.0, 1.0), 1.0), xt_sdHexagon(vec2(2.0 / sqrt(3.0), 0.0), 1.0), xt_sdHexagon(vec2(0.0), 1.0), length(xt_rotate(vec2(1.0, 0.0), 1.5707963) - vec2(0.0, 1.0)));
}`,
        inputs: [0, 0, 0, 0],
      }),
    );
    const [top, side, center, rotated] = out[0]!;
    expect(Math.abs(top!)).toBeLessThan(1e-5);
    expect(Math.abs(side!)).toBeLessThan(1e-5);
    expect(center!).toBeCloseTo(-1, 5);
    expect(rotated!).toBeLessThan(1e-5);
  });
});

test.describe('dither chunk (X2.6)', () => {
  test('Bayer matrices are the standard ordered patterns', async ({ page }) => {
    const inputs: number[] = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) inputs.push(x, y, 0, 0);
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/dither/ordered>
vec4 xt_test(vec4 v, int index) {
  ivec2 p = ivec2(v.xy);
  return vec4(xt_bayer(p, 1), xt_bayer(p, 2), xt_bayer(p, 3), xt_quantize(vec3(0.49), 2.0, xt_bayer(p, 3)).r);
}`,
        inputs,
      }),
    );
    const bayer4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    out.forEach(([b2, b4, b8, q], i) => {
      const x = i % 8;
      const y = Math.floor(i / 8);
      expect(b4!).toBeCloseTo((bayer4[y % 4]![x % 4]! + 0.5) / 16, 6);
      expect(b2!).toBeCloseTo(
        ([
          [0, 2],
          [3, 1],
        ][y % 2]![x % 2]! +
          0.5) /
          4,
        6,
      );
      expect(b8! * 64 - 0.5).toBeCloseTo(Math.round(b8! * 64 - 0.5), 4);
      expect([0, 1]).toContain(q);
    });
    // Each 8×8 threshold appears exactly once, and 49% grey lights about half the pixels.
    const levels = new Set(out.map((v) => Math.round(v[2]! * 64 - 0.5)));
    expect(levels.size).toBe(64);
    const lit = out.filter((v) => v[3] === 1).length;
    expect(lit).toBe(31);
  });
});
