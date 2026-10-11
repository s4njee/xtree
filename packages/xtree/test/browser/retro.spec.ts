import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 glitch and retro effects (X6.5–X6.10, X7.5–X7.10).
test.beforeEach(async ({ page }) => openFixture(page));

const render = (page: Page, spec: EffectSpec, time = 0) =>
  page
    .evaluate(
      ([s, t]) =>
        window.xt.renderFloat({
          toneMapping: 'none',
          effects: [s as EffectSpec],
          time: t as number,
        }),
      [spec, time] as const,
    )
    .then((r) => r.pixels);

test('neutral settings leave the image unchanged', async ({ page }) => {
  const plain = (
    await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' }))
  ).pixels;
  const neutral: EffectSpec[] = [
    { id: 'bit-crush', params: { amount: 0 } },
    { id: 'palette', params: { amount: 0 } },
    { id: 'slice-shift', params: { density: 0 } },
    { id: 'signal-loss', params: { frequency: 0 } },
    { id: 'ntsc', params: { artifacts: 0 } },
    { id: 'lcd', params: { amount: 0, persistence: 0 } },
    { id: 'pixel-sort', params: { amount: 0 } },
    { id: 'jpeg', params: { amount: 0 } },
    // The first frame is a keyframe.
    { id: 'datamosh' },
  ];
  for (const spec of neutral) {
    const pixels = await render(page, spec);
    expect(
      diff(plain, pixels, 1).maxChannel,
      `${spec.id} ${JSON.stringify(spec.params ?? {})}`,
    ).toBeLessThan(1);
  }
});

test('reductions use only the colors they promise', async ({ page }) => {
  const levels = (pixels: number[], channels = 3) => {
    const seen = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4)
      seen.add(
        Array.from({ length: channels }, (_, c) =>
          Math.round(pixels[i + c]! * 255),
        ).join(','),
      );
    return seen;
  };
  // One bit per channel: every channel is 0 or 255.
  const crushed = await render(page, { id: 'bit-crush', params: { bits: 1 } });
  for (const color of levels(crushed))
    for (const v of color.split(',').map(Number)) expect([0, 255]).toContain(v);
  // The Game Boy palette has four colors.
  const gameBoy = await render(page, {
    id: 'palette',
    params: { palette: 'gameBoy', dither: 0 },
  });
  expect(levels(gameBoy).size).toBeLessThanOrEqual(4);
  // Black and white error diffusion keeps the average brightness.
  const plain = (
    await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' }))
  ).pixels;
  const dithered = await render(page, {
    id: 'error-diffusion',
    params: { pixelSize: 1 },
  });
  const grays = levels(dithered);
  expect([...grays].every((c) => c === '0,0,0' || c === '255,255,255')).toBe(
    true,
  );
  const meanLuma = (p: number[]) => {
    let sum = 0;
    for (let i = 0; i < p.length; i += 4)
      sum +=
        0.2126 * Math.min(p[i]!, 1) +
        0.7152 * Math.min(p[i + 1]!, 1) +
        0.0722 * Math.min(p[i + 2]!, 1);
    return sum / (p.length / 4);
  };
  expect(Math.abs(meanLuma(dithered) - meanLuma(plain))).toBeLessThan(0.08);
  // Teletext: in color mode, every pixel is one of the eight broadcast colors.
  const teletext = await render(page, { id: 'teletext' });
  for (const color of levels(teletext))
    for (const v of color.split(',').map(Number)) expect([0, 255]).toContain(v);
});

test('JPEG quality sets how much the image changes', async ({ page }) => {
  const plain = (
    await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' }))
  ).pixels;
  const error = async (quality: number) =>
    diff(
      plain,
      await render(page, {
        id: 'jpeg',
        params: { jpegQuality: quality, subsample: false },
      }),
      1,
    ).deltaE999;
  const high = await error(98);
  const low = await error(5);
  expect(high).toBeLessThan(6);
  expect(low).toBeGreaterThan(high * 2);
});

test('datamosh smears the old picture along the motion', async ({ page }) => {
  const sharp = await page.evaluate(() =>
    window.xt.velocityProbe({
      move: [0.5, 0, 0],
      effect: { id: 'datamosh', params: { amount: 0 } },
    }),
  );
  const moshed = await page.evaluate(() =>
    window.xt.velocityProbe({
      move: [0.5, 0, 0],
      effect: { id: 'datamosh', params: { source: 'velocity', strength: 1 } },
    }),
  );
  const d = diff(sharp.pixels!, moshed.pixels!, 1);
  expect(d.maxChannel).toBeGreaterThan(20);
  expect(d.over2).toBeLessThan(0.3);
});

test('signal loss drops out briefly and recovers', async ({ page }) => {
  test.setTimeout(120_000);
  const plain = (
    await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' }))
  ).pixels;
  const spec: EffectSpec = {
    id: 'signal-loss',
    params: { frequency: 1, chance: 1, duration: 0.3, mode: 'noise' },
  };
  let dropped = 0;
  const frames = 25;
  for (let i = 0; i < frames; i++) {
    const pixels = await render(page, spec, i * 0.17);
    if (diff(plain, pixels, 1).maxChannel > 10) dropped++;
  }
  // About 30% of the time (0.3 s of each second), never all of it.
  expect(dropped).toBeGreaterThan(frames * 0.1);
  expect(dropped).toBeLessThan(frames * 0.5);
});

test('pixel sorting rearranges pixels without inventing new light', async ({
  page,
}) => {
  const total = (p: number[]) => {
    let sum = 0;
    for (let i = 0; i < p.length; i += 4) sum += p[i]! + p[i + 1]! + p[i + 2]!;
    return sum;
  };
  const unsorted = await render(page, {
    id: 'pixel-sort',
    params: { iterations: 4, low: 1, high: 1 },
  });
  const sorted = await render(page, {
    id: 'pixel-sort',
    params: { iterations: 128 },
  });
  expect(diff(unsorted, sorted, 1).maxChannel).toBeGreaterThan(10);
  expect(Math.abs(total(sorted) / total(unsorted) - 1)).toBeLessThan(0.02);
});
