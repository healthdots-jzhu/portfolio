import { test, expect } from '@playwright/test';

test('public portfolio loads and shows hero content', async ({ page }) => {
  await page.goto('/p/jason-zhu-EU1O');

  await expect(page.getByTestId('portfolio-navbar')).toBeVisible();
  await expect(page.getByTestId('person-hero-title')).not.toHaveText('');
});
