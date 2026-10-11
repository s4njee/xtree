import { expect, test } from '@playwright/test';
import { openFixture, png } from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

test.describe('clock and drivers (X1.10, X16.4)', () => {
  test('time holds until play() unless autoplay is set', async ({ page }) => {
    const clock = await page.evaluate(() => window.xt.clock());
    expect(clock.paused).toBe(0);
    expect(clock.played).toBeCloseTo(0.5, 6);
    expect(clock.autoplay).toBeCloseTo(0.5, 6);
  });

  test('progress, drivers, pointer and scroll reach every effect', async ({
    page,
  }) => {
    const read = (values: Parameters<typeof window.xt.inputs>[0]) =>
      page.evaluate((v) => window.xt.inputs(v), values);
    const base = await read({ progress: 0.25, pointer: [0.5, 0.75] });
    expect(base[0]! / 255).toBeCloseTo(0.25, 1);
    expect(base[1]! / 255).toBeCloseTo(0.5, 1);
    expect(base[2]! / 255).toBeCloseTo(0.75, 1);
    const driven = await read({ drive: 0.8 });
    expect(driven[0]! / 255).toBeCloseTo(0.8, 1);
    const scrolled = await read({ progress: 1, scroll: 1 });
    expect(scrolled[0]! / 255).toBeCloseTo(0.5, 1);
  });
});

test.describe('motion off (X16.2)', () => {
  test('no animated effect changes while motion is off', async ({ page }) => {
    test.slow();
    const ids = await page.evaluate(() =>
      window.xt.factories.filter((id) => window.xt.kind(id) !== 'transition'),
    );
    for (const id of ids) {
      const result = await page.evaluate(
        (effect) =>
          window.xt.motionOff({
            effects: [
              {
                id: effect,
                mask: 'demo',
                ...(effect === 'rgb-split-glitch'
                  ? { params: { trigger: 'always' } }
                  : {}),
              },
            ],
          }),
        id,
      );
      expect(result.changed, id).toBe(0);
    }
  });
});

test.describe('debug tooling (X1.14)', () => {
  test('describe() lists passes with their effects, buffers and shaders', async ({
    page,
  }) => {
    const { passes, timings } = await page.evaluate(() => window.xt.inspect());
    expect(passes.map((p) => p.effects)).toEqual([
      ['bloom', 'vignette', 'outline'],
    ]);
    expect(passes[0]!.buffers).toEqual(['depth', 'normal']);
    expect(passes[0]!.compiles).toBe(1);
    expect(passes[0]!.sourceLength).toBeGreaterThan(1000);
    // Timer queries are optional; when present every pass is measured.
    if (timings) expect(timings['pass 0']).toBeGreaterThanOrEqual(0);
  });
});

test('every blend mode, as a grid (X1.8)', async ({ page }) => {
  const { png: image, modes } = await page.evaluate(() =>
    window.xt.blendGrid(),
  );
  expect(modes).toBeGreaterThanOrEqual(16);
  expect(png(image)).toMatchSnapshot('blend-grid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.12,
  });
});

test.describe('motion policy (X16.1)', () => {
  const media = [
    {},
    { reducedMotion: 'reduce' },
    { contrast: 'more' },
    { reducedMotion: 'reduce', contrast: 'more' },
  ] as const;
  for (const settings of media) {
    test(`matches HoloCSS with ${JSON.stringify(settings)}`, async ({
      page,
    }) => {
      await page.emulateMedia(settings);
      const rows = await page.evaluate(() => window.xt.motionPolicies());
      expect(rows.length).toBe(7);
      for (const row of rows) expect(row.xtree, row.case).toBe(row.holocss);
      // Spot checks of the rule itself.
      const byCase = Object.fromEntries(rows.map((r) => [r.case, r.xtree]));
      expect(byCase['motion-none']).toBe(false);
      expect(byCase['high-contrast']).toBe(false);
      if (!('reducedMotion' in settings)) expect(byCase.plain).toBe(true);
      else expect(byCase.plain).toBe(false);
    });
  }
});
