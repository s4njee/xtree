import { expect, test } from './test.js';
import { openFixture } from './fixture.js';

// Performance features (X17.3–X17.5).
test.beforeEach(async ({ page }) => openFixture(page));

test('compileAsync compiles everything the first frame needs (X17.5)', async ({
  page,
}) => {
  const r = await page.evaluate(() => window.xt.compileWarmup());
  expect(r.compiled).toBeGreaterThan(r.start);
  expect(r.afterFirst).toBe(r.compiled);
});

test('the adaptive composer lowers resolution and quality, and restores them (X17.3)', async ({
  page,
}) => {
  const r = await page.evaluate(() => window.xt.adaptiveProbe());
  // An impossible target drives it to the floor: half resolution, low tier.
  expect(r.state).toEqual({ scale: 0.5, quality: 'low' });
  expect(r.scale).toBe(0.5);
  expect(r.lowered).toBeLessThan(r.before);
  // quality 'high' restores the effect's own values while the governor runs.
  expect(r.pinned).toBe(r.before);
  expect(r.restored).toEqual({ scale: 1, samples: r.before });
});

test('half resolution costs at least 40% less within the documented difference (X17.4)', async ({
  page,
}) => {
  test.setTimeout(300_000);
  for (const spec of [
    { id: 'ssao', full: { resolution: 1 }, half: { resolution: 0.5 } },
    {
      id: 'volumetric-fog',
      full: { resolution: 1 },
      half: { resolution: 0.5 },
    },
    {
      id: 'depth-of-field',
      full: { resolution: 'full', aperture: 4 },
      half: { resolution: 'half', aperture: 4 },
    },
  ]) {
    const r = await page.evaluate((s) => window.xt.halfResolution(s), spec);
    expect(r.halfCost, `${spec.id} ${JSON.stringify(r)}`).toBeLessThan(
      r.fullCost * 0.6,
    );
    // Documented on the performance guide: SSAO and fog under 1% mean and 10% at
    // the 99th percentile; depth of field, whose strongest blur differs most near
    // silhouettes, under 2% and 30%.
    const [mean, p99] =
      spec.id === 'depth-of-field' ? [0.02, 0.3] : [0.01, 0.1];
    expect(r.meanError, `${spec.id} ${JSON.stringify(r)}`).toBeLessThan(mean);
    expect(r.p99Error, `${spec.id} ${JSON.stringify(r)}`).toBeLessThan(p99);
  }
});
