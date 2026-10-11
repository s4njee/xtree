import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 color effects (X3.9–X3.15): neutral settings leave the image alone,
// and each control moves the image the way its description says.
test.beforeEach(async ({ page }) => openFixture(page));

const neutral: EffectSpec[] = [
  { id: 'levels' },
  { id: 'curves' },
  { id: 'white-balance' },
  { id: 'color-balance' },
  { id: 'channel-mixer' },
  { id: 'split-toning', params: { amount: 0 } },
  { id: 'bleach-bypass', params: { amount: 0 } },
];

/** Mean display-encoded RGB of a float render, clamped to 0–1 so HDR highlights don't dominate. */
const mean = (pixels: number[]) => {
  const sum = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4)
    for (let c = 0; c < 3; c++)
      sum[c]! += Math.min(1, Math.max(0, pixels[i + c]!));
  return sum.map((v) => v / (pixels.length / 4));
};

test('neutral settings leave the image unchanged', async ({ page }) => {
  const { pixels: plain } = await page.evaluate(() =>
    window.xt.renderFloat({ toneMapping: 'none' }),
  );
  for (const spec of neutral) {
    const { pixels } = await page.evaluate(
      (s) => window.xt.renderFloat({ effects: [s], toneMapping: 'none' }),
      spec,
    );
    const d = diff(plain, pixels, 1);
    // Curves sample a 256-texel table, so allow about one 8-bit level.
    expect(d.maxChannel, spec.id).toBeLessThan(
      spec.id === 'curves' ? 1.5 : 0.6,
    );
  }
});

test('each grading control moves the image the right way', async ({ page }) => {
  const render = (spec: EffectSpec) =>
    page
      .evaluate(
        (s) => window.xt.renderFloat({ effects: [s], toneMapping: 'none' }),
        spec,
      )
      .then((r) => r.pixels);
  const plain = mean(
    (await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' })))
      .pixels,
  );
  const min = (pixels: number[]) => {
    let m = Infinity;
    for (let i = 0; i < pixels.length; i += 4)
      m = Math.min(m, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    return m;
  };
  // Raising the output black point lifts the darkest pixel to it.
  expect(
    min(await render({ id: 'levels', params: { outputBlack: 0.2 } })),
  ).toBeGreaterThan(0.19);
  // Levels on one channel leaves the others alone.
  const red = mean(
    await render({ id: 'levels', params: { channel: 'red', gamma: 2 } }),
  );
  expect(red[0]).toBeGreaterThan(plain[0]! + 0.02);
  expect(red[1]).toBeCloseTo(plain[1]!, 2);
  // A fade curve lifts the blacks.
  expect(min(await render({ id: 'curves', preset: 'fade' }))).toBeGreaterThan(
    0.08,
  );
  // Correcting for tungsten light (3200 K) cools the image.
  const tungsten = mean(
    await render({ id: 'white-balance', params: { temperature: 3200 } }),
  );
  expect(tungsten[2]! / tungsten[0]!).toBeGreaterThan(plain[2]! / plain[0]!);
  // Gain on red only warms the highlights.
  const gain = mean(
    await render({ id: 'color-balance', params: { gain: [1.3, 1, 1] } }),
  );
  expect(gain[0]).toBeGreaterThan(plain[0]! + 0.02);
  // Swapping red and blue swaps their means.
  const swapped = mean(
    await render({ id: 'channel-mixer', preset: 'swapRedBlue' }),
  );
  expect(swapped[0]).toBeCloseTo(plain[2]!, 2);
  expect(swapped[2]).toBeCloseTo(plain[0]!, 2);
  // Toning with a blue shadow tint makes the image bluer.
  const toned = mean(
    await render({
      id: 'split-toning',
      params: { shadows: '#0000ff', highlights: '#0000ff', amount: 1 },
    }),
  );
  expect(toned[2]! - toned[0]!).toBeGreaterThan(plain[2]! - plain[0]!);
  // Bleach bypass desaturates.
  const spread = (c: number[]) => Math.max(...c) - Math.min(...c);
  const bleached = mean(
    await render({ id: 'bleach-bypass', params: { amount: 1 } }),
  );
  expect(spread(bleached)).toBeLessThan(spread(plain));
});
