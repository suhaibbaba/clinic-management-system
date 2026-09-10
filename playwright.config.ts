import { defineConfig, devices } from '@playwright/test';

// Deliberately small: proof that the app boots, that each role signs in, and that nothing scrolls
// sideways on a phone. Against the built bundle, since a dev overlay hides the failure.
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  // A screen that has not rendered in 30s is a failure, not a slow machine.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    // CI installs Playwright's own Chromium; a box that already has one sets `QA_CHROMIUM` and
    // skips a 150 MB download.
    ...(process.env['QA_CHROMIUM']
      ? { launchOptions: { executablePath: process.env['QA_CHROMIUM'] } }
      : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ar-SY',
  },
  projects: [
    {
      name: 'phone-ar',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      // The width that found this run's only overflow: three stat cards across
      // a 768px tablet, with a figure in each that does not break.
      name: 'tablet-ar',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-en',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
