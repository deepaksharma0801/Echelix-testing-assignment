import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the project root; silently ignored if file absent (CI injects vars directly)
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',

  // Global per-test timeout (ms) – generous to accommodate email polling
  timeout: 90_000,

  // Assertion timeout
  expect: { timeout: 10_000 },

  // Password-reset workflow is stateful; run tests sequentially
  fullyParallel: false,
  workers: 1,

  // Fail fast in CI on accidental .only() usage
  forbidOnly: !!process.env.CI,

  // One automatic retry in CI to absorb transient email-delivery delays
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL,

    // Capture traces / screenshots / video on failure for post-mortem debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
