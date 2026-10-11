import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { random, runShader, vec4s } from './harness.js';
import {
  linearToOklab,
  linearToSrgb,
  oklabToOklch,
  rgbToHsl,
  rgbToHsv,
  rgbToYiq,
  rgbToYuv,
  srgbToLinear,
  whitePointXy,
  xyToLinearSrgb,
  type Vec3,
} from './reference.js';

/** Random colors in [0, 1]^3, plus primaries, greys and black/white. */
function colors(count: number, seed: number): Vec3[] {
  const next = random(seed);
  const fixed: Vec3[] = [
    [0, 0, 0],
    [1, 1, 1],
    [0.5, 0.5, 0.5],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1],
    [0.2, 0.4, 0.6],
  ];
  return [
    ...fixed,
    ...Array.from({ length: count }, () => [next(), next(), next()] as Vec3),
  ];
}

const asInputs = (list: Vec3[]) => list.flatMap((c) => [...c, 0]);
const maxError = (a: readonly number[], b: readonly number[]) =>
  Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
const hueError = (a: number, b: number) =>
  Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

async function convert(
  page: Parameters<typeof runShader>[0],
  include: string,
  expression: string,
  list: Vec3[],
) {
  return vec4s(
    await runShader(page, {
      source: `#include <xtree/color/${include}>\nvec4 xt_test(vec4 c, int index) { return vec4(${expression}, 0.0); }`,
      inputs: asInputs(list),
    }),
  ).map((v) => [v[0], v[1], v[2]] as Vec3);
}

test.describe('sRGB transfer', () => {
  test('matches IEC 61966-2-1 and round-trips', async ({ page }) => {
    const list = colors(500, 1);
    const linear = await convert(page, 'space', 'xt_srgbToLinear(c.rgb)', list);
    const encoded = await convert(
      page,
      'space',
      'xt_linearToSrgb(c.rgb)',
      list,
    );
    const roundTrip = await convert(
      page,
      'space',
      'xt_linearToSrgb(xt_srgbToLinear(c.rgb))',
      list,
    );
    list.forEach((c, i) => {
      expect(maxError(linear[i]!, srgbToLinear(c))).toBeLessThan(1e-5);
      expect(maxError(encoded[i]!, linearToSrgb(c))).toBeLessThan(1e-5);
      expect(maxError(roundTrip[i]!, c)).toBeLessThan(1e-5);
    });
    const [half] = await convert(
      page,
      'space',
      'vec3(xt_srgbToLinear(vec3(0.5)).r, xt_linearToSrgb(vec3(0.5)).r, 0.0)',
      [[0, 0, 0]],
    );
    expect(half![0]).toBeCloseTo(0.214041, 5);
    expect(half![1]).toBeCloseTo(0.735357, 5);
  });
});

test.describe('HSV and HSL', () => {
  test('match the reference and round-trip within 1e-4', async ({ page }) => {
    const list = colors(1000, 2);
    const hsv = await convert(page, 'space', 'xt_rgbToHsv(c.rgb)', list);
    const hsl = await convert(page, 'space', 'xt_rgbToHsl(c.rgb)', list);
    const hsvBack = await convert(
      page,
      'space',
      'xt_hsvToRgb(xt_rgbToHsv(c.rgb))',
      list,
    );
    const hslBack = await convert(
      page,
      'space',
      'xt_hslToRgb(xt_rgbToHsl(c.rgb))',
      list,
    );
    list.forEach((c, i) => {
      const [h, s, v] = rgbToHsv(c);
      const [h2, s2, l] = rgbToHsl(c);
      if (s > 1e-4) expect(hueError(hsv[i]![0], h)).toBeLessThan(1e-4);
      expect(hsv[i]![1]).toBeCloseTo(s, 4);
      expect(hsv[i]![2]).toBeCloseTo(v, 5);
      if (s2 > 1e-4) expect(hueError(hsl[i]![0], h2)).toBeLessThan(1e-4);
      expect(hsl[i]![1]).toBeCloseTo(s2, 4);
      expect(hsl[i]![2]).toBeCloseTo(l, 5);
      expect(maxError(hsvBack[i]!, c)).toBeLessThan(1e-4);
      expect(maxError(hslBack[i]!, c)).toBeLessThan(1e-4);
    });
  });
});

test.describe('OKLab and OKLCH', () => {
  test('match the reference; OKLab round-trips within 1e-4, OKLCH within 5e-4', async ({
    page,
  }) => {
    const list = colors(1000, 3);
    const lab = await convert(page, 'space', 'xt_linearToOklab(c.rgb)', list);
    const lch = await convert(page, 'space', 'xt_linearToOklch(c.rgb)', list);
    const labBack = await convert(
      page,
      'space',
      'xt_oklabToLinear(xt_linearToOklab(c.rgb))',
      list,
    );
    const lchBack = await convert(
      page,
      'space',
      'xt_oklchToLinear(xt_linearToOklch(c.rgb))',
      list,
    );
    list.forEach((c, i) => {
      const reference = linearToOklab(c);
      expect(maxError(lab[i]!, reference)).toBeLessThan(1e-4);
      const [L, C, h] = oklabToOklch(reference);
      expect(lch[i]![0]).toBeCloseTo(L, 4);
      expect(lch[i]![1]).toBeCloseTo(C, 4);
      if (C > 1e-3) expect(hueError(lch[i]![2], h)).toBeLessThan(1e-4);
      expect(maxError(labBack[i]!, c)).toBeLessThan(1e-4);
      // OKLCH goes through atan, sin and cos, whose GPU precision (about 1.6e-4 rad
      // measured on SwiftShader) bounds the round trip more loosely than OKLab.
      expect(maxError(lchBack[i]!, c)).toBeLessThan(5e-4);
    });
    // White is L = 1 with no chroma.
    expect(maxError(lab[1]!, [1, 0, 0])).toBeLessThan(1e-4);
  });
});

test.describe('YIQ, YUV and luminance', () => {
  test('match the reference and round-trip within 1e-4', async ({ page }) => {
    const list = colors(1000, 4);
    const yiq = await convert(page, 'space', 'xt_rgbToYiq(c.rgb)', list);
    const yuv = await convert(page, 'space', 'xt_rgbToYuv(c.rgb)', list);
    const yiqBack = await convert(
      page,
      'space',
      'xt_yiqToRgb(xt_rgbToYiq(c.rgb))',
      list,
    );
    const yuvBack = await convert(
      page,
      'space',
      'xt_yuvToRgb(xt_rgbToYuv(c.rgb))',
      list,
    );
    list.forEach((c, i) => {
      expect(maxError(yiq[i]!, rgbToYiq(c))).toBeLessThan(1e-5);
      expect(maxError(yuv[i]!, rgbToYuv(c))).toBeLessThan(1e-5);
      expect(maxError(yiqBack[i]!, c)).toBeLessThan(1e-4);
      expect(maxError(yuvBack[i]!, c)).toBeLessThan(1e-4);
    });
    const [luma] = await convert(
      page,
      'luminance',
      'vec3(xt_luminance(vec3(1.0)), xt_luma601(vec3(1.0)), xt_luminance(vec3(0.0, 1.0, 0.0)))',
      [[0, 0, 0]],
    );
    expect(luma![0]).toBeCloseTo(1, 6);
    expect(luma![1]).toBeCloseTo(1, 6);
    expect(luma![2]).toBeCloseTo(0.7152, 6);
  });
});

test.describe('white balance', () => {
  test('6500 K with zero tint is the identity', async ({ page }) => {
    const list = colors(500, 5);
    const out = await convert(
      page,
      'white-balance',
      'xt_whiteBalance(c.rgb, 6500.0, 0.0)',
      list,
    );
    list.forEach((c, i) => expect(maxError(out[i]!, c)).toBeLessThan(1e-5));
  });

  test('white points match the reference and 6500 K is D65', async ({
    page,
  }) => {
    const settings: [number, number][] = [];
    for (const kelvin of [
      1667, 2000, 2800, 3500, 4500, 6500, 8000, 12000, 25000,
    ])
      for (const tint of [-1, -0.5, 0, 0.5, 1]) settings.push([kelvin, tint]);
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/color/white-balance>
vec4 xt_test(vec4 c, int index) { return vec4(xt_whitePointXy(c.x, c.y), 0.0, 0.0); }`,
        inputs: settings.flatMap(([k, t]) => [k, t, 0, 0]),
      }),
    );
    settings.forEach(([kelvin, tint], i) => {
      const [x, y] = whitePointXy(kelvin, tint);
      expect(out[i]![0]).toBeCloseTo(x, 5);
      expect(out[i]![1]).toBeCloseTo(y, 5);
    });
    const d65 = settings.findIndex(([k, t]) => k === 6500 && t === 0);
    expect(out[d65]![0]).toBeCloseTo(0.3127266, 6);
    expect(out[d65]![1]).toBeCloseTo(0.3290231, 6);
  });

  test('neutralizes the color of the assumed illuminant', async ({ page }) => {
    const settings: [number, number][] = [];
    for (const kelvin of [2000, 2800, 3500, 4500, 5500, 8000, 12000])
      for (const tint of [-0.5, 0, 0.5]) settings.push([kelvin, tint]);
    const lit = settings.map(([kelvin, tint]) =>
      xyToLinearSrgb(whitePointXy(kelvin, tint)),
    );
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/color/white-balance>
vec4 xt_test(vec4 c, int index) {
  vec3 rgb = texelFetch(xt_aux, ivec2(index, 0), 0).rgb;
  return vec4(xt_whiteBalance(rgb, c.x, c.y), 0.0);
}`,
        inputs: settings.flatMap(([k, t]) => [k, t, 0, 0]),
        aux: {
          width: lit.length,
          height: 1,
          data: lit.flatMap((c) => [...c, 0]),
        },
      }),
    );
    out.forEach(([r, g, b]) => {
      // The illuminant's own color comes out grey (luminance 1).
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(1e-4);
      expect(r).toBeCloseTo(1, 3);
    });
  });

  test('lower temperatures cool the image and positive tint adds magenta', async ({
    page,
  }) => {
    const [cool, warm, magenta] = await convert(
      page,
      'white-balance',
      'c.x == 0.0 ? xt_whiteBalance(vec3(0.5), 3000.0, 0.0) : c.x == 1.0 ? xt_whiteBalance(vec3(0.5), 10000.0, 0.0) : xt_whiteBalance(vec3(0.5), 6500.0, 0.5)',
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
    );
    expect(cool![2]).toBeGreaterThan(cool![0]);
    expect(warm![0]).toBeGreaterThan(warm![2]);
    expect(magenta![1]).toBeLessThan(magenta![0]);
    expect(magenta![1]).toBeLessThan(magenta![2]);
  });
});

test.describe('tone mapping', () => {
  const require = createRequire(import.meta.url);
  const threeChunk = readFileSync(
    require.resolve('three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js'),
    'utf8',
  );
  const threeSource = /`([\s\S]*)`/
    .exec(threeChunk)![1]!
    .replace(
      'uniform float toneMappingExposure;',
      'float toneMappingExposure = 1.0;',
    );
  const operators = [
    ['Linear', 'xt_tonemapLinear'],
    ['Reinhard', 'xt_tonemapReinhard'],
    ['Cineon', 'xt_tonemapCineon'],
    ['ACESFilmic', 'xt_tonemapAces'],
    ['AgX', 'xt_tonemapAgx'],
    ['Neutral', 'xt_tonemapNeutral'],
  ] as const;

  for (const [three, xtree] of operators) {
    test(`${xtree} matches three.js ${three}ToneMapping`, async ({ page }) => {
      const next = random(three.length);
      const inputs: number[] = [];
      for (let i = 0; i < 1024; i++) {
        const scale = 2 ** (next() * 10 - 5);
        inputs.push(
          next() * scale,
          next() * scale,
          next() * scale,
          [0.5, 1, 2][i % 3]!,
        );
      }
      const out = vec4s(
        await runShader(page, {
          prelude: threeSource,
          source: `#include <xtree/color/tonemap>
vec4 xt_test(vec4 c, int index) {
  toneMappingExposure = c.w;
  return vec4(${xtree}(c.rgb, c.w) - ${three}ToneMapping(c.rgb), ${xtree}(c.rgb, c.w).g);
}`,
          inputs,
        }),
      );
      for (const [dr, dg, db, value] of out) {
        expect(Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db))).toBeLessThan(
          1e-6,
        );
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  }
});
