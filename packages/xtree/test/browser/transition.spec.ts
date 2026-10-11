import { expect, test } from '@playwright/test';
import { diff, openFixture } from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

const presets = [undefined, 'dissolve', 'iris', 'sweep', 'vortex'];

test.describe('transitions (X13.1)', () => {
  test('every transition and preset shows from at 0 and to at 1', async ({
    page,
  }) => {
    test.slow();
    const images = await page.evaluate(() => window.xt.transitionImages());
    const ids = await page.evaluate(() =>
      window.xt.factories.filter((id) => window.xt.kind(id) === 'transition'),
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const names = await page.evaluate((i) => window.xt.presets(i), id);
      for (const preset of [undefined, ...names]) {
        for (const [progress, expected] of [
          [0, images.from],
          [1, images.to],
        ] as const) {
          const { pixels } = await page.evaluate(
            (s) => window.xt.renderTransition(s),
            { id, ...(preset ? { preset } : {}), progress },
          );
          const d = diff(pixels, expected);
          expect(d.over2, `${id} ${preset ?? 'default'} at ${progress}`).toBe(
            0,
          );
        }
      }
    }
  });

  test('halfway, the result lies between the two images', async ({ page }) => {
    const images = await page.evaluate(() => window.xt.transitionImages());
    const { pixels } = await page.evaluate(() =>
      window.xt.renderTransition({
        id: 'crossfade',
        params: { pattern: 'fade' },
        progress: 0.5,
      }),
    );
    // A plain crossfade blends linear colors, so in display values each channel sits between the two.
    for (let i = 0; i < pixels.length; i += 4 * 97) {
      for (let c = 0; c < 3; c++) {
        const lo = Math.min(images.from[i + c]!, images.to[i + c]!);
        const hi = Math.max(images.from[i + c]!, images.to[i + c]!);
        expect(pixels[i + c]!).toBeGreaterThanOrEqual(lo - 1);
        expect(pixels[i + c]!).toBeLessThanOrEqual(hi + 1);
      }
    }
  });

  test('toHoloEffect renders like the xtree runtime in a HoloCSS-style ShaderMaterial', async ({
    page,
  }) => {
    // Every render compiles a shader, which is slow in software renderers.
    test.slow();
    for (const preset of presets) {
      for (const progress of [0.3, 0.7]) {
        const spec = {
          id: 'crossfade',
          ...(preset ? { preset } : {}),
          progress,
        };
        const ours = await page.evaluate(
          (s) => window.xt.renderTransition(s),
          spec,
        );
        const holo = await page.evaluate(
          (s) => window.xt.renderTransition({ ...s, via: 'holocss' as const }),
          spec,
        );
        expect(holo.fallback).toBe('hcss-depth');
        expect(holo.name).toBe('Crossfade & luma wipe');
        const d = diff(ours.pixels, holo.pixels);
        expect(d.over2, `${preset ?? 'default'} at ${progress}`).toBeLessThan(
          0.002,
        );
      }
    }
  });
});

test.describe('HoloCSS transition3d() (X13.1)', () => {
  const srgbToLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const linearToSrgb = (v: number) =>
    255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

  test('runs a converted transition to completion with the expected pixels', async ({
    page,
  }) => {
    test.slow();
    const from = [200, 120, 60];
    const to = [40, 90, 200];
    // At 1, transition3d() finishes and removes its stage as it draws, so stop just short.
    for (const progress of [0, 0.5, 0.9]) {
      const result = await page.evaluate(
        (p) =>
          window.xt.holoTransition({
            id: 'crossfade',
            params: { pattern: 'fade' },
            progress: p,
          }),
        progress,
      );
      expect(result.errors).toEqual([]);
      expect(result.status).toBe('finished');
      expect(result.updates).toBe(1);
      // A crossfade blends linear colors; the stage encodes to sRGB.
      const expected = from.map((f, c) =>
        linearToSrgb(
          srgbToLinear(f) * (1 - progress) + srgbToLinear(to[c]!) * progress,
        ),
      );
      expect(result.pixel).toHaveLength(4);
      result.pixel.slice(0, 3).forEach((v, c) => {
        expect(Math.abs(v - expected[c]!)).toBeLessThanOrEqual(3);
      });
    }
  });

  test('every preset compiles and finishes in transition3d()', async ({
    page,
  }) => {
    test.slow();
    for (const preset of presets) {
      const result = await page.evaluate(
        (p) =>
          window.xt.holoTransition({
            id: 'crossfade',
            ...(p ? { preset: p } : {}),
            progress: 0.5,
          }),
        preset,
      );
      expect(result.errors, preset ?? 'default').toEqual([]);
      expect(result.status).toBe('finished');
      expect(result.pixel).toHaveLength(4);
    }
  });
});
