import { expect, test, type Page } from '@playwright/test';

// The M2 docs features: theme switcher and motion control (X19.4, X19.5),
// the landing hero (X19.6), compare (X19.10), code tabs (X19.11), URL state
// (X19.12), stats (X19.13), the WebGL2 fallback (X19.14), the gallery
// (X19.16, X19.17) and parameter search (X19.19).
const base = '/xtree';

const code = (page: Page) => page.locator('.xt-demo-code code');

async function openDemo(page: Page, path: string) {
  await page.goto(`${base}${path}`);
  await expect(page.locator('.xt-demo canvas')).toBeVisible({
    timeout: 20_000,
  });
}

test('the theme switcher persists the HoloCSS theme and re-themes demos', async ({
  page,
}) => {
  await openDemo(page, '/effects/outline');
  const theme = page.getByRole('combobox', { name: 'Theme' }).first();
  await expect(theme).toHaveValue('auto');
  await expect(theme.locator('option')).toHaveCount(18);
  // The outline's line color follows the theme accent.
  const lineColor = async () =>
    /color: '(#[0-9a-f]{6})'/.exec((await code(page).textContent()) ?? '')?.[1];
  await theme.selectOption('high-contrast');
  await expect(page.locator('html')).toHaveAttribute(
    'data-hcss-theme',
    'high-contrast',
  );
  await expect.poll(lineColor).toBe('#ffff00');
  await theme.selectOption('md7-dracula');
  await expect.poll(lineColor).not.toBe('#ffff00');
  expect(await page.evaluate(() => localStorage.getItem('hcss-theme'))).toBe(
    'md7-dracula',
  );
  // Restored before first paint on the next load (no flash of the default).
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { early?: string | undefined }).early =
        document.documentElement.dataset.hcssTheme;
    });
  });
  await page.reload();
  expect(
    await page.evaluate(() => (window as unknown as { early?: string }).early),
  ).toBe('md7-dracula');
});

test('the motion control stops the demos', async ({ page }) => {
  await openDemo(page, '/effects/film-grain');
  await expect(
    page.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Motion' }).first().uncheck();
  await expect(page.locator('html')).toHaveAttribute(
    'data-hcss-motion',
    'none',
  );
  await expect(
    page.locator('.xt-demo-meta', { hasText: 'Motion is off' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hcss-motion'))).toBe(
    'none',
  );
});

test('the landing hero loads after its poster', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/`);
  await expect(page.locator('.xt-hero-poster')).toBeVisible();
  await expect(page.locator('.xt-hero.xt-hero-live canvas')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.xt-family-grid a')).toHaveCount(12);
  expect(errors).toEqual([]);
});

test('compare works with the keyboard and touch', async ({ page }) => {
  await openDemo(page, '/effects/monochrome');
  await page.getByRole('switch', { name: 'Compare' }).check();
  const divider = page.getByRole('slider', {
    name: 'Before and after divider',
  });
  await expect(divider).toHaveAttribute('aria-valuenow', '50');
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '61');
  await page.keyboard.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '5');
  // A touch drag to a quarter of the way across.
  const stage = await page.locator('.xt-demo-stage').boundingBox();
  await divider.evaluate(
    (element, { x, y }) => {
      const event = (type: string, clientX: number) =>
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          clientX,
          clientY: y,
          bubbles: true,
        });
      const box = element.getBoundingClientRect();
      element.dispatchEvent(event('pointerdown', box.left + box.width / 2));
      element.dispatchEvent(event('pointermove', x));
      element.dispatchEvent(event('pointerup', x));
    },
    { x: stage!.x + stage!.width / 4, y: stage!.y + stage!.height / 2 },
  );
  await expect(divider).toHaveAttribute('aria-valuenow', '25');
});

test('code tabs show plain three.js and the HoloCSS helpers', async ({
  page,
}) => {
  await openDemo(page, '/effects/hologram');
  await expect(code(page)).toContainText('patchMaterial(material, effect);');
  await expect(code(page)).not.toContainText('@mk7s/xtree/holocss');
  await page.getByRole('tab', { name: 'With HoloCSS' }).click();
  await expect(code(page)).toContainText(
    "import { bindTheme, bindMotion } from '@mk7s/xtree/holocss';",
  );
  await expect(code(page)).toContainText(
    'bindMotion(effect, renderer.domElement);',
  );
});

test('URLs keep the preset and changed parameters', async ({ page }) => {
  await openDemo(page, '/effects/vignette?preset=cinematic&darkness=0.7');
  await expect(page.getByRole('slider', { name: 'Darkness' })).toHaveValue(
    '0.7',
  );
  await expect(code(page)).toContainText('roundness: 0.4');
  await expect(code(page)).toContainText('darkness: 0.7');
  await page.getByRole('slider', { name: 'Darkness' }).fill('0.5');
  await expect(page).toHaveURL(/\?preset=cinematic&darkness=0\.5$/);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/effects/vignette$`));
});

test('the stats overlay toggles', async ({ page }) => {
  await openDemo(page, '/effects/bloom');
  await expect(page.locator('.xt-debug')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Stats' }).check();
  await expect(page.locator('.xt-debug')).toContainText(/\d+ fps/);
  await page.getByRole('switch', { name: 'Stats' }).uncheck();
  await expect(page.locator('.xt-debug')).toHaveCount(0);
});

test('without WebGL2 a demo shows its poster and a notice', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return (original as (...a: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
  await page.goto(`${base}/effects/crt`);
  await expect(page.locator('.xt-demo-poster')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('needs WebGL2');
  expect(
    await page
      .locator('.xt-demo-poster')
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(320);
});

test('the gallery filters instantly', async ({ page }) => {
  await page.goto(`${base}/effects/`);
  const count = page.locator('.xt-catalogue-count');
  await expect(count).toContainText('39 of 39 effects');
  await page.getByRole('combobox', { name: 'Buffers' }).selectOption('depth');
  await expect(count).toContainText('4 of 39 effects');
  await expect(
    page.locator('.xt-effect-card[data-effect="depth-fog"]'),
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Still effects only' }).check();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(count).toContainText('39 of 39 effects');
  await page.getByRole('radio', { name: 'Material' }).check();
  await expect(page.locator('.xt-effect-card')).toHaveCount(5);
});

test('searching a parameter name finds the effects that have it', async ({
  page,
}) => {
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('searchbox').fill('threshold');
  const results = page.locator('.VPLocalSearchBox .result');
  await expect(results.first()).toBeVisible();
  const text = (await results.allTextContents()).join(' ');
  expect(text).toMatch(/Bloom/);
  expect(text).toMatch(/Invert \/ threshold/);
});
