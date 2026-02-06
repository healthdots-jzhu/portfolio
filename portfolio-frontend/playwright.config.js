import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: 'on',
    screenshot: 'on',
    video: 'on'
  },
  reporter: [['list'], ['html', { outputFolder: 'output/playwright-report', open: 'never' }]],
  outputDir: 'output/playwright'
});
