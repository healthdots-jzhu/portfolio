import { test, expect } from '@playwright/test';

test('unauthenticated users are redirected from /portfolios', async ({ page }) => {
  await page.goto('/portfolios');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('landing-hero-title')).toBeVisible();
});
