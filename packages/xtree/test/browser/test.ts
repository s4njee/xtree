import { test as base } from '@playwright/test';
import { saveCoverage } from './coverage.js';

export { expect } from '@playwright/test';

/**
 * Playwright's `test`, plus line coverage of the library source in Chromium
 * when XT_COVERAGE=1 (`pnpm test:coverage`).
 */
export const test = base.extend<{ coverage: void }>({
  coverage: [
    async ({ page, browserName }, use) => {
      const enabled =
        process.env.XT_COVERAGE === '1' && browserName === 'chromium';
      if (enabled)
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      if (enabled) saveCoverage(await page.coverage.stopJSCoverage());
    },
    { auto: true },
  ],
});
