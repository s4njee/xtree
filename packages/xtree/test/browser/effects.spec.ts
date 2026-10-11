import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 materials (X12.4–X12.10) and transitions (X13.3–X13.10).
test.beforeEach(async ({ page }) => openFixture(page));

const render = (page: Page, spec?: EffectSpec) =>
  page
    .evaluate(
      (s) =>
        window.xt.renderFloat({
          toneMapping: 'none',
          effects: s ? [s] : [],
        }),
      spec,
    )
    .then((r) => r.pixels);

const label = (spec: EffectSpec) =>
  `${spec.id} ${JSON.stringify(spec.params ?? {})}`;

test.describe('materials', () => {
  test('neutral settings leave the knot unchanged', async ({ page }) => {
    const plain = await render(page);
    for (const spec of [
      { id: 'toon', targets: ['knot'], params: { amount: 0 } },
      { id: 'triplanar', targets: ['knot'], params: { amount: 0 } },
      { id: 'matcap', targets: ['knot'], params: { amount: 0 } },
      { id: 'wobble', targets: ['knot'], params: { amplitude: 0 } },
    ] as EffectSpec[]) {
      const pixels = await render(page, spec);
      expect(diff(plain, pixels, 1).maxChannel, label(spec)).toBeLessThan(1);
    }
  });

  test('each material restyles the knot', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const plain = await render(page);
    for (const id of [
      'force-field',
      'toon',
      'wireframe',
      'x-ray',
      'wobble',
      'triplanar',
      'matcap',
    ]) {
      const pixels = await render(page, { id: id as never, targets: ['knot'] });
      expect(diff(plain, pixels, 1).over2, id).toBeGreaterThan(0.01);
    }
    expect(errors).toEqual([]);
  });

  test('wireframe lines follow the triangles, and need barycentrics', async ({
    page,
  }) => {
    const bright = (p: number[]) => {
      let n = 0;
      for (let i = 0; i < p.length; i += 4) if (p[i + 2]! > 1) n++;
      return n;
    };
    // Lines in white over a black fill: some pixels lit, most of the knot dark.
    const lined = await render(page, {
      id: 'wireframe',
      targets: ['knot'],
      params: {
        lineColor: '#ffffff',
        glow: 4,
        fillColor: '#000000',
        fillOpacity: 1,
      },
    });
    expect(bright(lined)).toBeGreaterThan(200);
    // The floor has no barycentrics: only the fill applies, without errors.
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const floor = await render(page, {
      id: 'wireframe',
      targets: ['floor'],
      params: { lineColor: '#ffffff', glow: 4, fillOpacity: 0 },
    });
    expect(diff(await render(page), floor, 1).maxChannel).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test('x-ray in hidden mode draws only where something covers the object', async ({
    page,
  }) => {
    const plain = await render(page);
    const always = await render(page, { id: 'x-ray', targets: ['knot'] });
    const hidden = await render(page, {
      id: 'x-ray',
      targets: ['knot'],
      params: { occlusion: 'hidden' },
    });
    // Nothing covers the knot, so in hidden mode it simply disappears.
    expect(diff(plain, always, 1).over2).toBeGreaterThan(0.01);
    expect(diff(always, hidden, 1).over2).toBeGreaterThan(0.01);
  });

  test('wobble moves the silhouette', async ({ page }) => {
    const plain = await render(page);
    const moved = await render(page, {
      id: 'wobble',
      targets: ['knot'],
      params: { amplitude: 0.15 },
    });
    expect(diff(plain, moved, 1).over2).toBeGreaterThan(0.01);
  });
});

test.describe('transitions', () => {
  test('a linear wipe has replaced the left half by the middle', async ({
    page,
  }) => {
    const images = await page.evaluate(() => window.xt.transitionImages());
    const { pixels, width, height } = await page.evaluate(() =>
      window.xt.renderTransition({
        id: 'wipe',
        params: { softness: 0.01 },
        progress: 0.5,
      }),
    );
    const at = (x: number, y: number) => (y * width + x) * 4;
    for (const y of [10, Math.floor(height / 2), height - 10]) {
      const left = at(Math.floor(width * 0.1), y);
      const right = at(Math.floor(width * 0.9), y);
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(pixels[left + c]! - images.to[left + c]!)).toBeLessThan(
          3,
        );
        expect(
          Math.abs(pixels[right + c]! - images.from[right + c]!),
        ).toBeLessThan(3);
      }
    }
  });

  test('every transition and preset stays within the flash limit over one second', async ({
    page,
  }) => {
    test.setTimeout(900_000);
    const ids = await page.evaluate(() =>
      window.xt.factories.filter((id) => window.xt.kind(id) === 'transition'),
    );
    for (const id of ids) {
      const presets = await page.evaluate((i) => window.xt.presets(i), id);
      for (const preset of [undefined, ...presets]) {
        const report = await page.evaluate(
          (s) => window.xt.transitionFlashCheck(s),
          { id, ...(preset ? { preset } : {}) },
        );
        expect(
          report.pass,
          `${id} ${preset ?? 'default'}: ${JSON.stringify(report)}`,
        ).toBe(true);
      }
    }
  });
});
