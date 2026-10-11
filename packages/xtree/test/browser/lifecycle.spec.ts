import { expect, test } from './test.js';
import { openFixture } from './fixture.js';

// X18.4: create, render and dispose every effect (post, material and
// transition) many times; GPU memory and the program count must return to
// the baseline. Every run cycles each effect once; the nightly run (and the
// release checklist) sets XT_NIGHTLY=1 for 1,000 cycles.
const nightly = process.env.XT_NIGHTLY === '1';
const cycles = nightly ? 1000 : 42;

test.beforeEach(async ({ page }) => openFixture(page));

test(`${cycles} create, render and dispose cycles return to the baseline`, async ({
  page,
}) => {
  test.setTimeout(nightly ? 3 * 3_600_000 : 300_000);
  const { before, during, after } = await page.evaluate(
    (n) => window.xt.lifecycle({ cycles: n, everyEffect: true }),
    cycles,
  );
  expect(during.programs).toBeGreaterThan(before.programs);
  expect(after).toEqual(before);
});

test('repeated context loss and restore keeps rendering', async ({ page }) => {
  test.setTimeout(nightly ? 600_000 : 120_000);
  for (let i = 0; i < (nightly ? 20 : 3); i++) {
    const result = await page.evaluate(() => window.xt.contextLoss());
    if (!result.supported) test.skip(true, 'WEBGL_lose_context is unavailable');
    expect(result.lit, `round ${i}`).toBeGreaterThan(1000);
  }
});
