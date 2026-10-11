import { expect, test } from '@playwright/test';
import { openFixture } from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

test.describe('patchMaterial (X12.1)', () => {
  test('patches every supported material type and unpatches cleanly', async ({
    page,
  }) => {
    const results = await page.evaluate(() => window.xt.materialTypes());
    expect(results.map((r) => r.name)).toHaveLength(7);
    for (const result of results) {
      expect(result.errors, result.name).toEqual([]);
      expect(result.changed, result.name).toBeGreaterThan(200);
      expect(result.restored, result.name).toBe(0);
    }
  });

  test('a float change recompiles nothing; a structural change recompiles', async ({
    page,
  }) => {
    const r = await page.evaluate(() => window.xt.materialRecompiles());
    expect(r.afterFloat).toBe(r.start);
    expect(r.flagged).toBe(true);
    expect(r.afterStructural).toBeGreaterThan(r.afterFloat);
  });

  test('patches compose: fresnel glow and dissolve on one material', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const plain = await page.evaluate(() =>
      window.xt.render({ effects: [{ id: 'dissolve', targets: ['knot'] }] }),
    );
    const both = await page.evaluate(() =>
      window.xt.render({
        effects: [
          { id: 'dissolve', targets: ['knot'] },
          { id: 'fresnel-glow', targets: ['knot'], preset: 'selected' },
        ],
      }),
    );
    expect(errors).toEqual([]);
    const differing = plain.pixels.filter(
      (v, i) => Math.abs(v - both.pixels[i]!) > 8,
    ).length;
    expect(differing).toBeGreaterThan(200);
  });
});
