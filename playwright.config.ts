import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// CI runs every engine; locally the default is Chromium. Override with
// XT_BROWSERS=chromium,firefox,webkit.
const browsers = (
  process.env.XT_BROWSERS ??
  (process.env.CI ? 'chromium,firefox,webkit' : 'chromium')
)
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

// Cloud containers ship a preinstalled Chromium that may not match this
// Playwright version; use it when Playwright's own build is absent.
const fallbackChromium = '/opt/pw-browsers/chromium';
const chromiumLaunch =
  !process.env.CI && existsSync(fallbackChromium)
    ? { executablePath: fallbackChromium }
    : {};

const projects = {
  chromium: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch },
  // Headless Firefox disables WebGL without a GPU; force it on so Mesa's software renderer is used.
  firefox: {
    ...devices['Desktop Firefox'],
    launchOptions: {
      firefoxUserPrefs: {
        'webgl.force-enabled': true,
        'webgl.disabled': false,
        // Let Web Audio start without a real gesture, as Chromium does headless.
        'media.autoplay.default': 0,
        'media.autoplay.block-webaudio': false,
      },
    },
  },
  webkit: devices['Desktop Safari'],
} as const;

export default defineConfig({
  testDir: 'packages/xtree/test/browser',
  // Visual baselines are per browser, in __baselines__/<browser>/ (see
  // expectImage in test/browser/fixture.ts).
  snapshotPathTemplate: '{testDir}/__baselines__/{arg}{ext}',
  // Writes every effect variant's shaders for the compile tests.
  globalSetup: './packages/xtree/test/browser/global-setup.ts',
  webServer: {
    command: 'pnpm --filter @mk7s/xtree fixtures',
    url: 'http://localhost:5179/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // XT_HEADED=1 runs browsers with a window (CI runs Firefox headed under Xvfb,
  // because headless Firefox on Linux has no WebGL without a display).
  use: { trace: 'retain-on-failure', headless: process.env.XT_HEADED !== '1' },
  projects: browsers.map((name) => {
    const use = projects[name as keyof typeof projects];
    if (!use) throw new Error(`Unknown browser in XT_BROWSERS: ${name}`);
    return { name, use };
  }),
});
