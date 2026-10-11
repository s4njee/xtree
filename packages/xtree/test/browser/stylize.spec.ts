import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 stylization and distortion effects (X8.4–X8.11, X9.3–X9.9).
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

test('neutral settings leave the image unchanged', async ({ page }) => {
  const plain = await render(page);
  const neutral: EffectSpec[] = [
    { id: 'heat-haze', params: { strength: 0 } },
    { id: 'wave-warp', params: { amplitude: 0 } },
    { id: 'twirl', params: { angle: 0 } },
    { id: 'bulge', params: { strength: 0 } },
    { id: 'flow-warp', params: { strength: 0 } },
    { id: 'emboss', params: { amount: 0 } },
    { id: 'mirror', params: { position: [1, 0] } },
  ];
  for (const spec of neutral) {
    const pixels = await render(page, spec);
    expect(
      diff(plain, pixels, 1).maxChannel,
      `${spec.id} ${JSON.stringify(spec.params)}`,
    ).toBeLessThan(1);
  }
});

test('mirror makes the frame symmetric', async ({ page }) => {
  const pixels = await render(page, { id: 'mirror' });
  const width = 320;
  const height = 180;
  let worst = 0;
  for (let y = 0; y < height; y += 7)
    for (let x = 0; x < width / 2; x += 5) {
      const a = (y * width + x) * 4;
      const b = (y * width + (width - 1 - x)) * 4;
      worst = Math.max(worst, Math.abs(pixels[a]! - pixels[b]!));
    }
  expect(worst).toBeLessThan(0.02);
});

test('kaleidoscope repeats around the center', async ({ page }) => {
  // With two segments the frame is point-symmetric about the center.
  const pixels = await render(page, {
    id: 'kaleidoscope',
    params: { segments: 2, offset: 0 },
  });
  const width = 320;
  const height = 180;
  let close = 0;
  let total = 0;
  for (let y = 10; y < height - 10; y += 9)
    for (let x = 10; x < width - 10; x += 9) {
      const a = (y * width + x) * 4;
      const b = ((height - 1 - y) * width + (width - 1 - x)) * 4;
      total++;
      if (Math.abs(pixels[a]! - pixels[b]!) < 0.05) close++;
    }
  expect(close / total).toBeGreaterThan(0.85);
});

test('painterly filters flatten texture but keep edges', async ({ page }) => {
  const roughness = (p: number[]) => {
    let sum = 0;
    for (let i = 4; i < p.length; i += 4) sum += Math.abs(p[i]! - p[i - 4]!);
    return sum;
  };
  const plain = roughness(await render(page));
  for (const spec of [
    { id: 'kuwahara' },
    { id: 'kuwahara', params: { sectors: 'four' } },
    { id: 'watercolor', params: { granulation: 0, wobble: 0 } },
    { id: 'mosaic', params: { lineWidth: 0 } },
    { id: 'posterize', params: { edges: 0 } },
  ] as EffectSpec[]) {
    const r = roughness(await render(page, spec));
    expect(r, `${spec.id} ${JSON.stringify(spec.params ?? {})}`).toBeLessThan(
      plain * 1.05,
    );
  }
});

test('line styles draw ink on paper', async ({ page }) => {
  // Ink styles: most pixels are paper, some are ink.
  for (const spec of [
    {
      id: 'edges',
      params: { style: 'ink', paper: '#ffffff', color: '#000000' },
    },
    { id: 'crosshatch', params: { paper: '#ffffff', ink: '#000000' } },
    {
      id: 'pencil',
      // Line art: the demo scene is dark enough that tone would cover the paper.
      params: { paper: '#ffffff', lead: '#000000', paperGrain: 0, shading: 0 },
    },
  ] as EffectSpec[]) {
    const p = await render(page, spec);
    let paper = 0;
    let ink = 0;
    for (let i = 0; i < p.length; i += 4) {
      const l = (p[i]! + p[i + 1]! + p[i + 2]!) / 3;
      if (l > 0.9) paper++;
      else if (l < 0.3) ink++;
    }
    const n = p.length / 4;
    expect(paper / n, spec.id).toBeGreaterThan(0.3);
    expect(ink / n, spec.id).toBeGreaterThan(0.01);
  }
});

test('Canny lines are thinner than Sobel lines', async ({ page }) => {
  const inked = async (method: string) => {
    const p = await render(page, {
      id: 'edges',
      params: { method, style: 'glow', color: '#ffffff', threshold: 0.2 },
    });
    let lit = 0;
    for (let i = 0; i < p.length; i += 4) if (p[i]! > 0.5) lit++;
    return lit;
  };
  const sobel = await inked('sobel');
  const canny = await inked('canny');
  expect(canny).toBeGreaterThan(0);
  expect(canny).toBeLessThan(sobel * 0.8);
});
