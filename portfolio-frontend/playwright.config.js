import { defineConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(configDir, '.env.e2e');
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const baseURL = process.env.E2E_BASE_URL || 'https://portfolio.healthdots.net';

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
