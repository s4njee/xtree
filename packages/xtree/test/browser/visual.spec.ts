import { readdirSync } from 'node:fs';
import { expect, test } from './test.js';
import { expectImage, openFixture, png, type RenderSpec } from './fixture.js';

// Baselines live in __baselines__/<browser>/; a browser without its own
// compares with Chromium's. After an intentional visual change run
// `pnpm test:visual --update` (or the "Visual baselines" workflow, which
// updates every browser in CI) and review the images.
const effects = readdirSync(new URL('../../src/effects/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

test.describe('visual baselines', () => {
  test.beforeEach(async ({ page }) => openFixture(page));

  for (const id of effects) {
    test(`${id}: default and presets`, async ({ page }) => {
      const presets: string[] = await page.evaluate(
        (effect) => window.xt.presets(effect as never),
        id,
      );
      expect(presets.length).toBeGreaterThanOrEqual(2);
      const kind = await page.evaluate((effect) => window.xt.kind(effect), id);
      if (kind === 'transition') {
        // Transitions halfway between the fixture's two test images.
        for (const preset of [undefined, ...presets]) {
          const { png: image } = await page.evaluate(
            (s) => window.xt.renderTransition(s),
            { id, ...(preset ? { preset } : {}), progress: 0.5 },
          );
          expectImage(png(image), `${id}-${preset ?? 'default'}.png`);
        }
        return;
      }
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
        expectImage(png(image), `${id}-${preset ?? 'default'}.png`);
      }
      // The test card: image, gradient ramps and text behind a 3D model.
      const { png: cardImage } = await page.evaluate(
        (s) => window.xt.render(s),
        {
          scene: 'card',
          effects: [
            {
              id: id as never,
              params: id === 'rgb-split-glitch' ? { trigger: 'always' } : {},
            },
          ],
        } satisfies RenderSpec,
      );
      expectImage(png(cardImage), `${id}-testcard.png`);
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
      expectImage(png(image), `${name}.png`);
    });
  }

  test('the scene without effects', async ({ page }) => {
    const { png: image } = await page.evaluate(() => window.xt.render({}));
    expectImage(png(image), 'scene.png');
    const { png: cardImage } = await page.evaluate(() =>
      window.xt.render({ scene: 'card' }),
    );
    expectImage(png(cardImage), 'testcard.png');
  });

  test('every blend mode, as a grid (X1.8)', async ({ page }) => {
    const { png: image, modes } = await page.evaluate(() =>
      window.xt.blendGrid(),
    );
    expect(modes).toBeGreaterThanOrEqual(16);
    expectImage(png(image), 'blend-grid.png');
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
    expectImage(png(image), 'stack.png');
  });
});
