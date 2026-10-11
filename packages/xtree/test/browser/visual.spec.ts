import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openFixture, png, type RenderSpec } from './fixture.js';

// Baselines live in __baselines__ and are shared by every browser. Regenerate
// them with `pnpm test:browser visual --update-snapshots` (Chromium) after an
// intentional visual change, and review the images.
const effects = readdirSync(new URL('../../src/effects/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const tolerance = { maxDiffPixelRatio: 0.01, threshold: 0.12 };

test.describe('visual baselines', () => {
  test.beforeEach(async ({ page }) => openFixture(page));

  for (const id of effects) {
    test(`${id}: default and presets`, async ({ page }) => {
      const presets: string[] = await page.evaluate(
        (effect) => window.xt.presets(effect as never),
        id,
      );
      expect(presets.length).toBeGreaterThanOrEqual(2);
      for (const preset of [undefined, ...presets]) {
        const spec: RenderSpec = {
          effects: [
            {
              id: id as never,
              ...(preset ? { preset } : {}),
              params: id === 'rgb-split-glitch' ? { trigger: 'always' } : {},
              mask: 'demo',
            },
          ],
        };
        const { png: image } = await page.evaluate(
          (s) => window.xt.render(s),
          spec,
        );
        expect
          .soft(png(image), `${id} ${preset ?? 'default'}`)
          .toMatchSnapshot(`${id}-${preset ?? 'default'}.png`, tolerance);
      }
    });
  }

  const masked: Record<string, RenderSpec> = {
    'mask-selection': {
      effects: [
        {
          id: 'rgb-split-glitch',
          params: { trigger: 'always', amount: 0.03 },
          mask: { selection: ['knot'] },
        },
      ],
    },
    'mask-xray-outline': {
      effects: [
        {
          id: 'outline',
          params: { color: '#ffd166', thickness: 2 },
          mask: { selection: ['ring'], xray: true },
        },
      ],
    },
    'mask-depth': {
      effects: [
        {
          id: 'monochrome',
          params: { mode: 'duotone' },
          mask: { depth: [0, 8], invert: true, feather: 1 },
        },
      ],
    },
    'mask-texture': {
      effects: [
        {
          id: 'hue-saturation',
          params: { hue: 120 },
          mask: { texture: 'gradient' },
        },
      ],
    },
    'depth-stack': {
      effects: [
        { id: 'depth-fog', preset: 'groundMist' },
        { id: 'outline', params: { color: '#101018' } },
        { id: 'vignette' },
      ],
    },
  };
  for (const [name, spec] of Object.entries(masked)) {
    test(`masks and buffers: ${name}`, async ({ page }) => {
      const { png: image } = await page.evaluate(
        (s) => window.xt.render(s),
        spec,
      );
      expect(png(image)).toMatchSnapshot(`${name}.png`, tolerance);
    });
  }

  test('the scene without effects', async ({ page }) => {
    const { png: image } = await page.evaluate(() => window.xt.render({}));
    expect(png(image)).toMatchSnapshot('scene.png', tolerance);
  });

  test('a full stack', async ({ page }) => {
    const { png: image, passes } = await page.evaluate(() =>
      window.xt.render({
        effects: [
          { id: 'bloom' },
          { id: 'chromatic-aberration', preset: 'lens' },
          { id: 'vignette' },
          {
            id: 'rgb-split-glitch',
            params: { trigger: 'always', amount: 0.004 },
          },
          { id: 'holographic-foil', preset: 'card' },
        ],
      }),
    );
    expect(passes).toBe(3);
    expect(png(image)).toMatchSnapshot('stack.png', tolerance);
  });
});
