import { expect, test } from '@playwright/test';
import {
  diff,
  openFixture,
  type EffectSpec,
  type RenderSpec,
} from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

test.describe('effect merging', () => {
  const stacks = {
    'pixel effects': [
      { id: 'vignette', preset: 'glow' },
      { id: 'holographic-foil', preset: 'prism' },
      {
        id: 'vignette',
        params: { mode: 'eskil' },
        blend: 'multiply',
        opacity: 0.6,
      },
      { id: 'holographic-foil', preset: 'halo', blend: 'screen', opacity: 0.5 },
      { id: 'vignette', preset: 'subtle' },
    ],
    'mixed stack': [
      { id: 'bloom' },
      { id: 'vignette' },
      { id: 'chromatic-aberration', preset: 'lens' },
      { id: 'holographic-foil' },
      { id: 'rgb-split-glitch', params: { trigger: 'always' } },
      { id: 'vignette', preset: 'subtle' },
    ],
  } satisfies Record<string, EffectSpec[]>;
  for (const [name, effects] of Object.entries(stacks) as [
    string,
    EffectSpec[],
  ][]) {
    test(`${name}: merged output matches unmerged within ΔE 1`, async ({
      page,
    }) => {
      // Compared in float, before 8-bit quantization (one 8-bit level near black is already ~ΔE 1).
      const merged = await page.evaluate(
        (e) => window.xt.renderFloat({ effects: e, merge: true }),
        effects,
      );
      const unmerged = await page.evaluate(
        (e) => window.xt.renderFloat({ effects: e, merge: false }),
        effects,
      );
      expect(merged.passes).toBeLessThan(unmerged.passes);
      expect(unmerged.passes).toBe(effects.length);
      const d = diff(merged.pixels, unmerged.pixels, 1);
      expect(d.deltaE999).toBeLessThan(1);
      expect(d.maxDeltaE).toBeLessThan(3);
    });
  }

  test('five pixel effects compile into one pass', async ({ page }) => {
    const { passes } = await page.evaluate(
      (e) => window.xt.render({ effects: e }),
      stacks['pixel effects'],
    );
    expect(passes).toBe(1);
  });
});

test.describe('output stage', () => {
  for (const toneMapping of [
    'none',
    'linear',
    'reinhard',
    'cineon',
    'aces',
    'agx',
    'neutral',
  ] as const) {
    for (const colorSpace of ['srgb', 'linear'] as const) {
      test(`${toneMapping} / ${colorSpace}: an empty stack matches a plain render`, async ({
        page,
      }) => {
        // three.js clears with the background color without tone mapping it, while
        // any post-processing pipeline (three's OutputPass too) tone-maps it; compare on black.
        const spec: RenderSpec = {
          toneMapping,
          colorSpace,
          noBackground: true,
        };
        const composed = await page.evaluate((s) => window.xt.render(s), spec);
        const plain = await page.evaluate(
          (s) => window.xt.renderPlain(s),
          spec,
        );
        const d = diff(composed.pixels, plain.pixels);
        // Half-float buffers round slightly differently from a direct render.
        expect(d.over2).toBeLessThan(0.001);
        expect(d.maxDeltaE).toBeLessThan(2);
      });
    }
  }
});

test('every effect works inside three.js EffectComposer', async ({ page }) => {
  const effects: EffectSpec[] = [
    { id: 'vignette' },
    { id: 'chromatic-aberration', preset: 'lens' },
    { id: 'bloom' },
    { id: 'rgb-split-glitch', params: { trigger: 'always' } },
    { id: 'holographic-foil' },
  ];
  const ours = await page.evaluate(
    (e) => window.xt.render({ effects: e }),
    effects,
  );
  const three = await page.evaluate(
    (e) =>
      window.xt.renderThreeComposer({ groups: e.map((effect) => [effect]) }),
    effects,
  );
  const d = diff(ours.pixels, three.pixels);
  expect(d.over2).toBeLessThan(0.005);
  expect(d.maxDeltaE).toBeLessThan(3);
});

test('a float change recompiles nothing; a structural change recompiles one pass', async ({
  page,
}) => {
  const result = await page.evaluate(() => window.xt.recompiles());
  // bloom + vignette share a pass; chromatic aberration (an input effect) starts another.
  expect(result.passes).toBe(2);
  expect(result.afterFloat).toEqual(result.start);
  expect(result.afterStructural.compiles).toBe(result.start.compiles + 1);
  expect(result.passCompiles).toEqual([1, 2]);
});

test('disposing returns GPU memory and programs to the baseline', async ({
  page,
}) => {
  const { before, during, after } = await page.evaluate(() =>
    window.xt.lifecycle(),
  );
  expect(during.textures).toBeGreaterThan(before.textures);
  expect(during.programs).toBeGreaterThan(before.programs);
  expect(after).toEqual(before);
});

test('resizing reallocates the buffers once per size', async ({ page }) => {
  const { first, afterResize, size, final } = await page.evaluate(() =>
    window.xt.resize(),
  );
  expect(first).toBe(1);
  expect(afterResize).toBe(1);
  expect(size).toEqual({ width: 200, height: 100 });
  expect(final).toBe(3);
});

test.describe('motion', () => {
  test('freeze: holographic foil holds still with motion off', async ({
    page,
  }) => {
    const effects: EffectSpec[] = [
      { id: 'holographic-foil', params: { speed: 2 } },
    ];
    const moving = await page.evaluate(
      (e) => window.xt.motionPair({ effects: e, times: [0, 3] }),
      effects,
    );
    expect(diff(moving.first, moving.second).maxChannel).toBeGreaterThan(10);
    const still = await page.evaluate(
      (e) => window.xt.motionPair({ effects: e, times: [0, 3], motion: false }),
      effects,
    );
    expect(diff(still.first, still.second).maxChannel).toBe(0);
  });

  test('settle: the glitch stops jumping but keeps a static split', async ({
    page,
  }) => {
    const effects: EffectSpec[] = [
      {
        id: 'rgb-split-glitch',
        params: { trigger: 'always', amount: 0.02, jitter: 1 },
      },
    ];
    const moving = await page.evaluate(
      (e) => window.xt.motionPair({ effects: e, times: [0, 0.37] }),
      effects,
    );
    expect(diff(moving.first, moving.second).maxChannel).toBeGreaterThan(10);
    const still = await page.evaluate(
      (e) =>
        window.xt.motionPair({ effects: e, times: [0, 0.37], motion: false }),
      effects,
    );
    expect(diff(still.first, still.second).maxChannel).toBe(0);
    const plain = await page.evaluate(() => window.xt.render({}));
    expect(diff(still.first, plain.pixels).maxChannel).toBeGreaterThan(10);
  });
});

test('compile errors name the effect and line', async ({ page }) => {
  const logged = await page.evaluate(() => window.xt.brokenShader());
  expect(logged.join('\n')).toMatch(
    /xtree: an effect pass failed to compile[\s\S]*ERROR: effect\/0\/broken-fixture:2: .*e0_missing/,
  );
});

test('the composer recovers from a lost WebGL context', async ({ page }) => {
  const result = await page.evaluate(() => window.xt.contextLoss());
  test.skip(!result.supported, 'WEBGL_lose_context is unavailable');
  expect(result.lit).toBeGreaterThan(1000);
});

test.describe('LUT', () => {
  test('an identity LUT changes nothing', async ({ page }) => {
    const plain = await page.evaluate(() =>
      window.xt.render({ toneMapping: 'none' }),
    );
    const identity = await page.evaluate(() =>
      window.xt.render({
        toneMapping: 'none',
        effects: [{ id: 'lut', params: { lut: 'identity' } }],
      }),
    );
    expect(diff(identity.pixels, plain.pixels).over2).toBeLessThan(0.001);
  });

  test('texels are red-fastest and interpolation is exact for linear maps', async ({
    page,
  }) => {
    // A LUT that maps (r, g, b) to (g, b, r) must permute the output channels.
    const size = 17;
    const data: number[] = [];
    for (let b = 0; b < size; b++)
      for (let g = 0; g < size; g++)
        for (let r = 0; r < size; r++)
          data.push(g / (size - 1), b / (size - 1), r / (size - 1), 1);
    const plain = await page.evaluate(() =>
      window.xt.render({ toneMapping: 'none' }),
    );
    const swapped = await page.evaluate(
      (args) => window.xt.renderLutData({ toneMapping: 'none', ...args }),
      { size, data },
    );
    const expected = plain.pixels.map((_, i) => {
      const channel = i % 4;
      return channel === 3
        ? plain.pixels[i]!
        : plain.pixels[i - channel + ((channel + 1) % 3)]!;
    });
    expect(diff(swapped.pixels, expected).over2).toBeLessThan(0.001);
  });
});
