import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { openFixture, type MaskSpec, type RenderSpec } from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

const render = (page: Page, spec: RenderSpec) =>
  page.evaluate((s) => window.xt.render(s), spec);

/** The mask an effect sees, as 0–255 per pixel, from the buffer view. */
async function maskOf(page: Page, mask: MaskSpec): Promise<number[]> {
  const { pixels } = await render(page, {
    toneMapping: 'none',
    effects: [{ id: 'buffer-view', params: { buffer: 'mask' }, mask }],
  });
  return pixels.filter((_, i) => i % 4 === 0);
}

/** Largest channel difference per pixel between two renders. */
const changed = (a: number[], b: number[]) =>
  Array.from({ length: a.length / 4 }, (_, i) =>
    Math.max(...[0, 1, 2].map((c) => Math.abs(a[i * 4 + c]! - b[i * 4 + c]!))),
  );

test.describe('geometry buffers (X1.6)', () => {
  test('no prepass or depth texture unless an enabled effect needs one', async ({
    page,
  }) => {
    expect(await render(page, {})).toMatchObject({
      prepasses: 0,
      depth: false,
    });
    expect(
      await render(page, { effects: [{ id: 'vignette' }, { id: 'bloom' }] }),
    ).toMatchObject({ prepasses: 0, depth: false });
    expect(
      await render(page, { effects: [{ id: 'depth-fog', enabled: false }] }),
    ).toMatchObject({ prepasses: 0, depth: false });
  });

  test('depth effects get a depth texture; normal effects add one prepass', async ({
    page,
  }) => {
    expect(
      await render(page, { effects: [{ id: 'depth-fog' }] }),
    ).toMatchObject({ prepasses: 0, depth: true });
    expect(
      await render(page, {
        effects: [{ id: 'outline', params: { edges: 'depth' } }],
      }),
    ).toMatchObject({ prepasses: 0, depth: true });
    expect(
      await render(page, {
        effects: [
          { id: 'outline' },
          { id: 'buffer-view', params: { buffer: 'normal' } },
        ],
      }),
    ).toMatchObject({ prepasses: 1, depth: true });
  });

  test('a depth mask brings in the depth texture', async ({ page }) => {
    expect(
      await render(page, {
        effects: [{ id: 'monochrome', mask: { depth: [0, 8] } }],
      }),
    ).toMatchObject({ prepasses: 0, depth: true });
  });

  test('depth effects merge with pixel effects into one pass', async ({
    page,
  }) => {
    const result = await render(page, {
      effects: [
        { id: 'depth-fog' },
        { id: 'outline' },
        { id: 'vignette' },
        { id: 'monochrome', mask: { depth: [0, 8] } },
      ],
    });
    expect(result.passes).toBe(1);
  });
});

test.describe('masks (X1.9)', () => {
  test('one prepass per distinct selection, shared masks render once', async ({
    page,
  }) => {
    const two = await render(page, {
      effects: [
        { id: 'monochrome', mask: { selection: ['knot'] } },
        { id: 'vignette', mask: { selection: ['box'] } },
      ],
    });
    expect(two.prepasses).toBe(2);
    const shared = await render(page, {
      sharedMask: { selection: ['knot'] },
      effects: [
        { id: 'monochrome', mask: 'shared' },
        { id: 'vignette', mask: 'shared' },
      ],
    });
    expect(shared.prepasses).toBe(1);
  });

  test('a selection mask limits an effect to the selected object', async ({
    page,
  }) => {
    const mask = await maskOf(page, { selection: ['knot'] });
    const inside = mask.filter((v) => v > 250).length;
    expect(inside).toBeGreaterThan(1000);
    expect(mask.filter((v) => v > 5 && v < 250).length).toBeLessThan(
      inside / 2,
    );
    const plain = await render(page, {});
    const glitched = await render(page, {
      effects: [
        {
          id: 'monochrome',
          params: { mode: 'duotone' },
          mask: { selection: ['knot'] },
        },
      ],
    });
    const delta = changed(plain.pixels, glitched.pixels);
    const outside = delta.filter((d, i) => mask[i] === 0 && d > 2).length;
    const inner = delta.filter((d, i) => mask[i] === 255 && d > 2).length;
    expect(outside).toBe(0);
    expect(inner).toBeGreaterThan(inside * 0.9);
  });

  test('x-ray shows selected objects through what hides them', async ({
    page,
  }) => {
    // The ring passes behind the knot.
    const hidden = await maskOf(page, { selection: ['ring'] });
    const xray = await maskOf(page, { selection: ['ring'], xray: true });
    const count = (m: number[]) => m.filter((v) => v > 128).length;
    expect(count(xray)).toBeGreaterThan(count(hidden) + 20);
    expect(hidden.every((v, i) => v <= xray[i]! + 2)).toBe(true);
  });

  test('layer selections, inversion, depth ranges and texture channels', async ({
    page,
  }) => {
    const knot = await maskOf(page, { selection: ['knot'] });
    const inverted = await maskOf(page, { selection: ['knot'], invert: true });
    expect(knot.every((v, i) => Math.abs(v + inverted[i]! - 255) <= 1)).toBe(
      true,
    );
    // Nothing is on layer 5 in the studio.
    expect((await maskOf(page, { layer: 5 })).every((v) => v === 0)).toBe(true);
    // The background is beyond 20 units; the knot is about 7 away.
    const near = await maskOf(page, { depth: [0, 20] });
    expect(near[0]).toBe(0);
    expect(near.filter((v, i) => knot[i] === 255 && v < 250).length).toBe(0);
    // The fixture's gradient texture runs from 0 at the left to 1 at the right.
    const ramp = await maskOf(page, { texture: 'gradient', channel: 'a' });
    expect(ramp[0]!).toBeLessThan(5);
    expect(ramp[319]!).toBeGreaterThan(250);
    expect(Math.abs(ramp[160]! - 128)).toBeLessThan(8);
  });

  test('custom-masked effects outline and bloom only the selection', async ({
    page,
  }) => {
    const plain = await render(page, {});
    const knot = await maskOf(page, { selection: ['knot'] });
    const outlined = await render(page, {
      effects: [
        {
          id: 'outline',
          mask: { selection: ['knot'] },
          params: { thickness: 2 },
        },
      ],
    });
    const delta = changed(plain.pixels, outlined.pixels);
    // Lines sit just outside the knot and nowhere else.
    const lines = delta.flatMap((d, i) => (d > 10 ? [i] : []));
    expect(lines.length).toBeGreaterThan(200);
    for (const i of lines) expect(knot[i]!).toBeLessThan(250);
    // Selective bloom of the box leaves the orb's surroundings dark, unlike bloom.
    const orbSide = (pixels: number[]) => pixels[(110 * 320 + 25) * 4]!;
    const bloomed = await render(page, { effects: [{ id: 'bloom' }] });
    const selective = await render(page, {
      effects: [{ id: 'selective-bloom', mask: { selection: ['box'] } }],
    });
    expect(orbSide(bloomed.pixels)).toBeGreaterThan(orbSide(plain.pixels) + 10);
    expect(
      Math.abs(orbSide(selective.pixels) - orbSide(plain.pixels)),
    ).toBeLessThan(4);
  });
});
