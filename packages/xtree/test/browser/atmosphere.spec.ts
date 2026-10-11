import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 atmosphere and holographic effects (X10.2–X10.5, X11.4–X11.9).
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

const total = (pixels: number[]) => {
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4)
    sum += pixels[i]! + pixels[i + 1]! + pixels[i + 2]!;
  return sum;
};

// The largest amount any channel went up (positive) or down (negative).
const extremes = (before: number[], after: number[]) => {
  let up = 0;
  let down = 0;
  for (let i = 0; i < before.length; i++) {
    if (i % 4 === 3) continue;
    const d = after[i]! - before[i]!;
    up = Math.max(up, d);
    down = Math.min(down, d);
  }
  return { up, down };
};

test('neutral settings leave the image unchanged', async ({ page }) => {
  const plain = await render(page);
  for (const spec of [
    { id: 'ssao', params: { intensity: 0 } },
    { id: 'volumetric-fog', params: { density: 0 } },
    { id: 'god-rays', params: { intensity: 0 } },
    { id: 'screen-rim', params: { intensity: 0 } },
    { id: 'prism', params: { amount: 0 } },
    { id: 'glitter', params: { intensity: 0 } },
    { id: 'moire', params: { amount: 0 } },
    { id: 'hud-grid', params: { intensity: 0, sweep: 0 } },
  ] as EffectSpec[]) {
    const pixels = await render(page, spec);
    expect(diff(plain, pixels, 1).maxChannel, label(spec)).toBeLessThan(1);
  }
});

test('ambient occlusion only darkens, and most where surfaces meet', async ({
  page,
}) => {
  const plain = await render(page);
  const shaded = await render(page, { id: 'ssao', params: { intensity: 2 } });
  const { up } = extremes(plain, shaded);
  expect(up).toBeLessThan(1e-3);
  expect(total(shaded)).toBeLessThan(total(plain) * 0.995);
  // The occlusion buffer is mostly open, with some occluded areas where the
  // knot crosses itself and the cube meets the floor.
  const ao = await render(page, { id: 'ssao', params: { debug: true } });
  let open = 0;
  let occluded = 0;
  for (let i = 0; i < ao.length; i += 4) {
    if (ao[i]! > 0.95) open++;
    else if (ao[i]! < 0.8) occluded++;
  }
  const n = ao.length / 4;
  expect(open / n).toBeGreaterThan(0.4);
  expect(occluded / n).toBeGreaterThan(0.003);
});

test('volumetric fog thickens with density', async ({ page }) => {
  const plain = await render(page);
  // Black fog only absorbs, so it can only darken.
  const absorb = (density: number) =>
    render(page, {
      id: 'volumetric-fog',
      params: { density, color: '#000000', noise: 0, windSpeed: 0 },
    });
  const thin = await absorb(0.05);
  const thick = await absorb(0.4);
  expect(extremes(plain, thin).up).toBeLessThan(1e-3);
  expect(total(thick)).toBeLessThan(total(thin));
  expect(total(thin)).toBeLessThan(total(plain));
  // Lit fog adds light where the scene is dark.
  const lit = await render(page, {
    id: 'volumetric-fog',
    params: { density: 0.4, brightness: 2 },
  });
  expect(total(lit)).toBeGreaterThan(total(thick));
});

test('light effects only add light', async ({ page }) => {
  const plain = await render(page);
  for (const spec of [
    { id: 'god-rays', params: { position: [0.3, 0.75] } },
    { id: 'screen-rim' },
    { id: 'glitter' },
  ] as EffectSpec[]) {
    const pixels = await render(page, spec);
    const { down } = extremes(plain, pixels);
    expect(down, label(spec)).toBeGreaterThan(-1e-3);
    expect(total(pixels), label(spec)).toBeGreaterThan(total(plain) * 1.001);
  }
});

test('prism disperses without adding or losing much light', async ({
  page,
}) => {
  const plain = await render(page);
  const split = await render(page, { id: 'prism', params: { spread: 0.03 } });
  expect(diff(plain, split, 1).maxChannel).toBeGreaterThan(10);
  expect(Math.abs(total(split) / total(plain) - 1)).toBeLessThan(0.05);
});
