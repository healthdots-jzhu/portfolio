import { test, expect } from '@playwright/test';

const splitEnvList = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const pickFromEnv = (key) => {
  const list = splitEnvList(process.env[key]);
  if (list.length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return list[Math.floor(Math.random() * list.length)];
};

const fillIfPresent = async (page, labelPattern, value) => {
  const field = page.getByLabel(labelPattern, { exact: false });
  if (await field.count()) {
    await field.first().fill(value);
  }
};

test('signup (if needed) and login via Cognito hosted UI', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL || 'http://localhost:5173';
  const email = pickFromEnv('E2E_LOGIN_EMAILS');
  const password = pickFromEnv('E2E_LOGIN_PASSWORDS');
  const firstName = pickFromEnv('E2E_LOGIN_FIRST_NAMES');
  const lastName = pickFromEnv('E2E_LOGIN_LAST_NAMES');

  await page.goto('/');

  const authLink = page.getByTestId('landing-cta-primary');
  await expect(authLink).toBeVisible();
  const authUrl = await authLink.getAttribute('href');
  expect(authUrl, 'Auth URL should be present on the CTA').toBeTruthy();

  await page.goto(authUrl);

  const signUpLink = page.getByRole('link', { name: /sign up|sign-up|create account/i });
  if (await signUpLink.count()) {
    await signUpLink.first().click();

    await fillIfPresent(page, /first name|given name/i, firstName);
    await fillIfPresent(page, /last name|family name/i, lastName);
    await fillIfPresent(page, /email|username/i, email);

    const passwordFields = page.locator('input[type="password"]');
    const passwordCount = await passwordFields.count();
    for (let i = 0; i < passwordCount; i += 1) {
      await passwordFields.nth(i).fill(password);
    }

    const signUpButton = page.getByRole('button', { name: /sign up|create account|register/i });
    if (await signUpButton.count()) {
      await signUpButton.first().click();
    }

    await page.waitForTimeout(1000);
  }

  const alreadyExistsMessage = page.getByText(/already exists|user exists|an account with the given email/i);
  if (await alreadyExistsMessage.count()) {
    const signInLink = page.getByRole('link', { name: /sign in|log in|sign-in/i });
    if (await signInLink.count()) {
      await signInLink.first().click();
    }
  }

  if (!page.url().includes('/auth/callback')) {
    await fillIfPresent(page, /email|username/i, email);

    const passwordFields = page.locator('input[type="password"]');
    if (await passwordFields.count()) {
      await passwordFields.first().fill(password);
    }

    const signInButton = page.getByRole('button', { name: /sign in|log in|sign-in/i });
    if (await signInButton.count()) {
      await signInButton.first().click();
    }

    await page.waitForURL(/\/auth\/callback\?/);
  }

  const baseRegex = new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`);
  await page.waitForURL(baseRegex);
  await expect(page.getByTestId('landing-cta-primary')).toHaveAttribute('href', '/portfolios');
});
