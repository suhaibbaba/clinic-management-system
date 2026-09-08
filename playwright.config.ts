import { defineConfig, devices } from '@playwright/test';

/**
 * The end-to-end smoke run.
 *
 * Deliberately small. The visual sweep (`pnpm qa:screens`) walks every screen
 * at three viewports in two languages and produces images for a human to look
 * at; that is a tool, not a gate. What CI needs is the cheap half of it: proof
 * that the app boots, that each role can sign in, that the screens they are
 * entitled to actually render, and that none of them scrolls sideways on a
 * phone — the class of breakage that is invisible in a unit test and obvious
 * to anybody holding the device.
 *
 * It runs against the built web bundle served by `vite preview`, with the API
 * and a seeded database already up (see .github/workflows/ci.yml), because a
 * dev server's error overlay can hide the very failure this is looking for.
 */
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
    /*
     * A Chromium that is already on the machine, when there is one.
     *
     * CI installs Playwright's own and needs none of this; a sandbox or a
     * developer box with a system Chromium sets `QA_CHROMIUM` — the same
     * variable the visual sweep reads — and skips a 150 MB download.
     */
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
