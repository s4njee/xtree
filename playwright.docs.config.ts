import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Tests the built documentation site (run `pnpm docs:build` first).
const fallbackChromium = '/opt/pw-browsers/chromium';
const launchOptions =
  !process.env.CI && existsSync(fallbackChromium)
    ? { executablePath: fallbackChromium }
    : {};

export default defineConfig({
  testDir: 'docs/tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report-docs' }],
      ]
    : 'list',
  use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
  ],
  webServer: {
    command: 'pnpm --filter xtree-docs exec vitepress preview --port 4174',
    url: 'http://localhost:4174/xtree/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
