import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import effectSidebar from '../.vitepress/effects.json' with { type: 'json' };

// HoloCSS's built-in palettes, read at run time from the pinned source the
// site was built with (scripts/holocss.mjs fetches it during the docs build).
const holocss = process.env.HOLOCSS_DIR
  ? resolve(process.env.HOLOCSS_DIR)
  : fileURLToPath(new URL('../../.cache/holocss/', import.meta.url));
const { builtinThemes } = (await import(
  pathToFileURL(resolve(holocss, 'src/theme/registry.ts')).href
)) as {
  builtinThemes: readonly string[];
};

const base = '/xtree';
const effectLinks = effectSidebar.flatMap((group) =>
  group.items.map((item) => item.link),
);

/** Collects console errors and warnings that indicate a real problem. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' ||
      /Too many active WebGL contexts/.test(text)
    )
      problems.push(text);
  });
  return problems;
}

function luminance([r, g, b]: number[]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(a: number[], b: number[]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

test.describe('theme contrast', () => {
  for (const theme of builtinThemes) {
    test(`${theme}: text and links meet 4.5:1 on the page background`, async ({
      page,
    }) => {
      await page.addInitScript(
        (value) => localStorage.setItem('hcss-theme', value),
        theme,
      );
      await page.goto(`${base}/guide/`);
      const colors = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const read = (variable: string) => {
          probe.style.color = `var(${variable})`;
          return getComputedStyle(probe)
            .color.match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
        };
        const result = {
          bg: read('--vp-c-bg'),
          text: read('--vp-c-text-1'),
          muted: read('--vp-c-text-2'),
          link: read('--vp-c-brand-1'),
          theme: document.documentElement.dataset.hcssResolvedTheme,
        };
        probe.remove();
        return result;
      });
      expect(
        contrast(colors.text, colors.bg),
        'body text',
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colors.muted, colors.bg),
        'secondary text',
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.link, colors.bg), 'links').toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }
});

test('every page renders without console errors', async ({ page }) => {
  const problems = watchConsole(page);
  for (const path of [
    '/',
    '/guide/',
    '/guide/getting-started',
    '/effects/',
    ...effectLinks,
    '/reference/shaders',
    '/project/',
    '/adr/',
  ]) {
    await page.goto(`${base}${path}`);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test('the demo responds to its controls', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(`${base}/effects/vignette`);
  await expect(page.locator('.xt-demo canvas')).toBeVisible();
  const darkness = page.getByRole('slider', { name: 'Darkness' });
  await darkness.fill('0.9');
  await expect(page.locator('.xt-demo-code code')).toContainText(
    'vignette({ darkness: 0.9 })',
  );
  await page.getByRole('button', { name: 'Cinematic' }).click();
  await expect(page.locator('.xt-demo-code code')).toContainText(
    'roundness: 0.4',
  );
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.xt-demo-code code')).toContainText(
    'composer.add(vignette());',
  );
  expect(problems).toEqual([]);
});

test('client-side navigation between effects keeps one WebGL context', async ({
  page,
}) => {
  // Sixteen navigations over eight effects spread through the catalogue, each
  // starting a demo in a software renderer. Every page is also loaded on its
  // own by the console-error test.
  test.setTimeout(180_000);
  const count = Math.min(8, effectLinks.length);
  const links = Array.from(
    { length: count },
    (_, i) => effectLinks[Math.floor((i * effectLinks.length) / count)]!,
  );
  const problems = watchConsole(page);
  await page.goto(`${base}${links[0]}`);
  for (let round = 0; round < 2; round++) {
    for (const link of links) {
      await page.locator(`.VPSidebar a[href="${base}${link}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${link}$`));
      // The first demo loads three.js and compiles in a software renderer, which can take a while under load.
      await expect(page.locator('.xt-demo canvas')).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator('.xt-demo-status')).toHaveCount(0);
    }
  }
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __xtreeLiveDemos?: number }).__xtreeLiveDemos,
    ),
  ).toBe(1);
  expect(problems).toEqual([]);
});

test('with reduced motion the demo does not autoplay', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/effects/holographic-foil`);
  await expect(page.locator('.xt-demo canvas')).toBeVisible();
  await expect(
    page.locator('.xt-demo-meta', { hasText: 'Motion is off' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeVisible();
  await context.close();
});
