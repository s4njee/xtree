import { expect, test } from './test.js';
import { random, runShader, vec4s } from './harness.js';

/** Random points, 4 coordinates each, spread over [-scale, scale]. */
function points(count: number, seed: number, scale = 64): number[] {
  const next = random(seed);
  return Array.from({ length: count * 4 }, () => (next() * 2 - 1) * scale);
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;
const std = (values: number[]) => {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
};

test.describe('hashes', () => {
  test('xt_hash1 is uniform on [0, 1)', async ({ page }) => {
    const inputs = points(8192, 1);
    const out = await runShader(page, {
      source: `#include <xtree/noise/hash>
vec4 xt_test(vec4 v, int index) { return vec4(xt_hash1(v.xy), xt_hash1(v.xyz), xt_hash1(v), xt_hash1(v.x)); }`,
      inputs,
    });
    for (let channel = 0; channel < 4; channel++) {
      const values = out.filter((_, i) => i % 4 === channel);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...values)).toBeLessThan(1);
      const bins = new Array(16).fill(0);
      for (const v of values) bins[Math.floor(v * 16)]++;
      const expected = values.length / 16;
      const chiSquare = bins.reduce(
        (sum, observed) => sum + (observed - expected) ** 2 / expected,
        0,
      );
      // 15 degrees of freedom; 37.7 is the 99.9th percentile.
      expect(chiSquare).toBeLessThan(37.7);
    }
  });

  test('vector hashes have uncorrelated components', async ({ page }) => {
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/hash>
vec4 xt_test(vec4 v, int index) { return vec4(xt_hash3(v.xyz), xt_hash2(v.xy).y); }`,
        inputs: points(8192, 2),
      }),
    );
    const xs = out.map((v) => v[0]);
    const ys = out.map((v) => v[1]);
    const zs = out.map((v) => v[2]);
    const correlation = (a: number[], b: number[]) => {
      const ma = mean(a);
      const mb = mean(b);
      return mean(a.map((v, i) => (v - ma) * (b[i]! - mb))) / (std(a) * std(b));
    };
    expect(Math.abs(correlation(xs, ys))).toBeLessThan(0.05);
    expect(Math.abs(correlation(ys, zs))).toBeLessThan(0.05);
    expect(Math.abs(correlation(xs, zs))).toBeLessThan(0.05);
  });

  test('integer lattice hashes are deterministic', async ({ page }) => {
    const inputs = [3, -7, 12, 0, 3, -7, 12, 0, 4, -7, 12, 0];
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/hash>
vec4 xt_test(vec4 v, int index) { return xt_latticeHash(ivec4(v)); }`,
        inputs,
      }),
    );
    expect(out[0]).toEqual(out[1]);
    expect(out[0]).not.toEqual(out[2]);
  });
});

interface NoiseCase {
  readonly name: string;
  /** GLSL expression of `p` (vec4, use a swizzle). */
  readonly expression: string;
  readonly include: string;
  readonly range: readonly [number, number];
  /** Lipschitz bound: no step of 1e-3 may change the value by more than this times the step. */
  readonly maxSlope: number;
  readonly zeroMean?: boolean;
}

const noises: NoiseCase[] = [
  {
    name: 'value 2D',
    include: 'value',
    expression: 'xt_valueNoise(p.xy)',
    range: [0, 1],
    maxSlope: 4,
  },
  {
    name: 'value 3D',
    include: 'value',
    expression: 'xt_valueNoise(p.xyz)',
    range: [0, 1],
    maxSlope: 4,
  },
  {
    name: 'perlin 2D',
    include: 'perlin',
    expression: 'xt_perlin(p.xy)',
    range: [-1, 1],
    maxSlope: 6,
    zeroMean: true,
  },
  {
    name: 'perlin 3D',
    include: 'perlin',
    expression: 'xt_perlin(p.xyz)',
    range: [-1, 1],
    maxSlope: 6,
    zeroMean: true,
  },
  {
    name: 'simplex 2D',
    include: 'simplex',
    expression: 'xt_simplex(p.xy)',
    range: [-1, 1],
    maxSlope: 8,
    zeroMean: true,
  },
  {
    name: 'simplex 3D',
    include: 'simplex',
    expression: 'xt_simplex(p.xyz)',
    range: [-1, 1],
    maxSlope: 8,
    zeroMean: true,
  },
  {
    name: 'simplex 4D',
    include: 'simplex',
    expression: 'xt_simplex(p)',
    range: [-1, 1],
    maxSlope: 8,
    zeroMean: true,
  },
  {
    name: 'fbm 2D',
    include: 'fbm',
    expression: 'xt_fbm(p.xy, 5, 2.0, 0.5)',
    range: [-1, 1],
    maxSlope: 16,
    zeroMean: true,
  },
  {
    name: 'fbm 3D',
    include: 'fbm',
    expression: 'xt_fbm(p.xyz, 5, 2.0, 0.5)',
    range: [-1, 1],
    maxSlope: 16,
    zeroMean: true,
  },
];

test.describe('lattice noises', () => {
  for (const noise of noises) {
    test(`${noise.name}: range, spread, mean and continuity`, async ({
      page,
    }) => {
      // Each input is a random point and a random unit direction; the shader
      // returns the value there and the slope along that direction.
      const next = random(noise.name.length * 7919);
      const inputs: number[] = [];
      for (let i = 0; i < 8192; i++)
        inputs.push(...[0, 0, 0, 0].map(() => (next() * 2 - 1) * 40));
      const out = vec4s(
        await runShader(page, {
          source: `#include <xtree/noise/${noise.include}>
float xt_eval(vec4 p) { return ${noise.expression}; }
vec4 xt_test(vec4 p, int index) {
  vec4 dir = normalize(vec4(sin(float(index) * 1.7), cos(float(index) * 2.3), sin(float(index) * 0.9 + 1.0), cos(float(index) * 1.3 + 2.0)));
  const float h = 1e-3;
  float v = xt_eval(p);
  return vec4(v, abs(xt_eval(p + dir * h) - v) / h, 0.0, 0.0);
}`,
          inputs,
        }),
      );
      const values = out.map((v) => v[0]);
      const slopes = out.map((v) => v[1]);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(noise.range[0]);
      expect(Math.max(...values)).toBeLessThanOrEqual(noise.range[1]);
      // The output uses a meaningful part of its range.
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(
        0.5 * (noise.range[1] - noise.range[0]),
      );
      if (noise.zeroMean) expect(Math.abs(mean(values))).toBeLessThan(0.05);
      else expect(Math.abs(mean(values) - 0.5)).toBeLessThan(0.05);
      expect(Math.max(...slopes)).toBeLessThan(noise.maxSlope);
    });
  }

  test('gradient noise is zero at lattice points', async ({ page }) => {
    const next = random(5);
    const inputs = Array.from({ length: 256 * 4 }, () =>
      Math.round((next() * 2 - 1) * 100),
    );
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/perlin>
vec4 xt_test(vec4 p, int index) { return vec4(xt_perlin(p.xy), xt_perlin(p.xyz), 0.0, 0.0); }`,
        inputs,
      }),
    );
    for (const [a, b] of out) {
      expect(Math.abs(a)).toBeLessThan(1e-6);
      expect(Math.abs(b)).toBeLessThan(1e-6);
    }
  });

  test('value noise equals the lattice hash at lattice points', async ({
    page,
  }) => {
    const next = random(6);
    const inputs = Array.from({ length: 256 * 4 }, () =>
      Math.round((next() * 2 - 1) * 100),
    );
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/value>
vec4 xt_test(vec4 p, int index) {
  return vec4(xt_valueNoise(p.xy), xt_latticeHash(ivec3(ivec2(p.xy), 0)).x, xt_valueNoise(p.xyz), xt_latticeHash(ivec3(p.xyz)).x);
}`,
        inputs,
      }),
    );
    for (const [a, b, c, d] of out) {
      expect(a).toBeCloseTo(b, 6);
      expect(c).toBeCloseTo(d, 6);
    }
  });

  test('one-octave fbm equals simplex noise', async ({ page }) => {
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/fbm>
vec4 xt_test(vec4 p, int index) { return vec4(xt_fbm(p.xy, 1, 2.0, 0.5), xt_simplex(p.xy), xt_fbm(p.xyz, 1, 2.0, 0.5), xt_simplex(p.xyz)); }`,
        inputs: points(512, 7, 20),
      }),
    );
    for (const [a, b, c, d] of out) {
      expect(a).toBe(b);
      expect(c).toBe(d);
    }
  });
});

test.describe('worley', () => {
  test('with no jitter, F1 and F2 are distances to the nearest cell centers', async ({
    page,
  }) => {
    const inputs = points(2048, 8, 20);
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/worley>
vec4 xt_test(vec4 p, int index) { return vec4(xt_worley(p.xy, 0.0), xt_worley(p.xyz, 0.0)); }`,
        inputs,
      }),
    );
    out.forEach(([f1, f2, g1, g2], index) => {
      const p = inputs.slice(index * 4, index * 4 + 3).map(Math.fround) as [
        number,
        number,
        number,
      ];
      const distances2: number[] = [];
      const distances3: number[] = [];
      for (let z = -1; z <= 1; z++)
        for (let y = -1; y <= 1; y++)
          for (let x = -1; x <= 1; x++) {
            const center = [
              Math.floor(p[0]) + x + 0.5,
              Math.floor(p[1]) + y + 0.5,
              Math.floor(p[2]) + z + 0.5,
            ];
            const d = Math.hypot(
              center[0]! - p[0],
              center[1]! - p[1],
              center[2]! - p[2],
            );
            distances3.push(d);
            if (z === 0)
              distances2.push(Math.hypot(center[0]! - p[0], center[1]! - p[1]));
          }
      distances2.sort((a, b) => a - b);
      distances3.sort((a, b) => a - b);
      expect(f1).toBeCloseTo(distances2[0]!, 4);
      expect(f2).toBeCloseTo(distances2[1]!, 4);
      expect(g1).toBeCloseTo(distances3[0]!, 4);
      expect(g2).toBeCloseTo(distances3[1]!, 4);
    });
  });

  test('with full jitter, 0 <= F1 <= F2', async ({ page }) => {
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/worley>
vec4 xt_test(vec4 p, int index) { return vec4(xt_worley(p.xy, 1.0), xt_worley(p.xyz, 1.0)); }`,
        inputs: points(4096, 9),
      }),
    );
    for (const [f1, f2, g1, g2] of out) {
      expect(f1).toBeGreaterThanOrEqual(0);
      expect(f2).toBeGreaterThanOrEqual(f1);
      expect(g1).toBeGreaterThanOrEqual(0);
      expect(g2).toBeGreaterThanOrEqual(g1);
      expect(f1).toBeLessThan(Math.SQRT2);
      expect(g1).toBeLessThan(Math.sqrt(3));
    }
  });
});

test.describe('curl', () => {
  // The shader only evaluates the field (one call site, quick to compile on
  // software renderers); central differences are taken here from offset points.
  for (const axes of [2, 3] as const) {
    test(`${axes}D curl fields are divergence free`, async ({ page }) => {
      const h = 0.02;
      const centers = vec4s(points(256, 10, 8));
      const inputs = centers.flatMap((c) =>
        Array.from({ length: axes }, (_, axis) =>
          [h, -h].flatMap((d) => c.map((v, i) => (i === axis ? v + d : v))),
        ).flat(),
      );
      const out = vec4s(
        await runShader(page, {
          source: `#include <xtree/noise/curl>
vec4 xt_test(vec4 p, int index) {
  return vec4(xt_curl(p.${axes === 2 ? 'xy' : 'xyz'})${axes === 2 ? ', 0.0, 0.0' : ', 0.0'});
}`,
          inputs,
        }),
      );
      let div = 0;
      let scale = 0;
      centers.forEach((_, n) => {
        let pointDiv = 0;
        for (let axis = 0; axis < axes; axis++) {
          const plus = out[(n * axes + axis) * 2]!;
          const minus = out[(n * axes + axis) * 2 + 1]!;
          pointDiv += (plus[axis]! - minus[axis]!) / (2 * h);
          const other = (axis + 1) % axes;
          scale += Math.abs(plus[other]! - minus[other]!) / (2 * h);
        }
        div += Math.abs(pointDiv);
      });
      // Compare the divergence with the size of the off-diagonal derivatives.
      expect(scale / centers.length).toBeGreaterThan(1);
      expect(div / scale).toBeLessThan(0.02);
    });
  }
});

test.describe('dither noise', () => {
  test('interleaved gradient noise is in [0, 1) and changes per frame', async ({
    page,
  }) => {
    const inputs: number[] = [];
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) inputs.push(x + 0.5, y + 0.5, 0, 0);
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/noise/blue>
vec4 xt_test(vec4 p, int index) { return vec4(xt_ign(p.xy), xt_ign(p.xy, 0), xt_ign(p.xy, 1), xt_ign(p.xy, 64)); }`,
        inputs,
      }),
    );
    const values = out.map((v) => v[0]);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(Math.abs(mean(values) - 0.5)).toBeLessThan(0.02);
    expect(out.every((v) => v[0] === v[1])).toBe(true);
    expect(out.filter((v) => v[1] !== v[2]).length).toBeGreaterThan(
      out.length * 0.9,
    );
    // Frame 64 repeats frame 0.
    expect(out.every((v) => Math.abs(v[1] - v[3]) < 1e-6)).toBe(true);
  });

  test('blue noise sampling tiles and moves along R2 each frame', async ({
    page,
  }) => {
    const size = 4;
    const data: number[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) data.push(y * size + x, 0, 0, 0);
    const cases: [number, number, number][] = [];
    for (let frame = 0; frame < 6; frame++)
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < 6; x++) cases.push([x, y, frame]);
    const out = await runShader(page, {
      source: `#include <xtree/noise/blue>
vec4 xt_test(vec4 p, int index) { return vec4(xt_blueNoise(xt_aux, ivec2(p.xy), int(p.z)).x, xt_r2(int(p.z)), 0.0); }`,
      inputs: cases.flatMap(([x, y, frame]) => [x, y, frame, 0]),
      aux: { width: size, height: size, data },
    });
    vec4s(out).forEach(([value, r2x, r2y], index) => {
      const [x, y, frame] = cases[index]!;
      const ox = Math.floor(Math.fround(((frame * 0.754877666247) % 1) * size));
      const oy = Math.floor(Math.fround(((frame * 0.569840290998) % 1) * size));
      expect(r2x).toBeCloseTo((frame * 0.754877666247) % 1, 5);
      expect(r2y).toBeCloseTo((frame * 0.569840290998) % 1, 5);
      expect(value).toBe(((y + oy) % size) * size + ((x + ox) % size));
    });
  });
});
