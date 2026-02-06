import { test, expect } from '@playwright/test';

test('landing page and legal navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('landing-hero-title')).toBeVisible();
  await expect(page.getByTestId('landing-cta-primary')).toBeVisible();

  await page.getByTestId('landing-footer-privacy').click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId('legal-page')).toBeVisible();

  await page.getByTestId('legal-footer-terms').click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByTestId('legal-page')).toBeVisible();
});
