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

const INVALID_CREDENTIALS_PATTERN = /incorrect username or password|invalid input|user does not exist|unable to verify secret hash|password attempts exceeded/i;
const COGNITO_HOST_PATTERN = /auth\.healthdots\.net/i;
const CONFIRM_ACCOUNT_PATTERN = /confirm your account|we have sent a code|enter your code|confirm account/i;

const waitForAuthResult = async (page) => {
  const callbackPromise = page
    .waitForURL(/\/auth\/callback\?/, { timeout: 25_000 })
    .then(() => ({ type: 'callback' }));

  const errorPromise = page
    .getByText(INVALID_CREDENTIALS_PATTERN)
    .first()
    .waitFor({ state: 'visible', timeout: 25_000 })
    .then(async () => ({
      type: 'error',
      message: (await page
        .getByText(INVALID_CREDENTIALS_PATTERN)
        .first()
        .innerText()) || 'Authentication failed on Cognito login page'
    }));

  const confirmAccountPromise = page
    .getByText(CONFIRM_ACCOUNT_PATTERN)
    .first()
    .waitFor({ state: 'visible', timeout: 25_000 })
    .then(() => ({
      type: 'verification_required',
      message: 'Signup reached Cognito account confirmation. Email verification code is required.'
    }));

  return Promise.race([callbackPromise, errorPromise, confirmAccountPromise]);
};

const buildSignupAliasEmail = (email) => {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  const suffix = `${Date.now().toString().slice(-6)}`;
  return `${localPart}+e2e${suffix}@${domain}`;
};

const attemptLogin = async (page, email, password) => {
  if (!COGNITO_HOST_PATTERN.test(new URL(page.url()).host)) {
    throw new Error(`Expected Cognito hosted UI, but found: ${page.url()}`);
  }

  await fillIfPresent(page, /email|username/i, email);
  const passwordFields = page.locator('input[type="password"]');
  if (await passwordFields.count()) {
    await passwordFields.first().fill(password);
  }

  const signInButton = page.getByRole('button', { name: /^(sign in|log in)$/i, exact: false });
  if (await signInButton.count()) {
    await signInButton.first().click();
  }

  return waitForAuthResult(page);
};

const attemptSignup = async (page, email, password, firstName, lastName) => {
  const signUpLink = page.getByRole('link', { name: /^(sign up|create an account)$/i, exact: false });
  if (await signUpLink.count()) {
    await Promise.all([
      page.waitForURL(/\/signup/i, { timeout: 10_000 }).catch(() => null),
      signUpLink.first().click()
    ]);
  }

  const isSignupPage = page.url().includes('/signup');
  if (!isSignupPage) {
    return { type: 'signup_not_reached' };
  }

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

  await page.waitForTimeout(1200);

  if (page.url().includes('/auth/callback')) {
    return { type: 'callback', emailUsed: email };
  }

  const alreadyExistsMessage = page.getByText(/already exists|user exists|an account with the given email/i);
  if (await alreadyExistsMessage.count()) {
    return { type: 'exists' };
  }

  const signInLink = page.getByRole('link', { name: /^(sign in|log in)$/i, exact: false });
  if (await signInLink.count()) {
    await signInLink.first().click();
  }

  return { type: 'ready_to_login', emailUsed: email };
};

test('signup (if needed) and login via Cognito hosted UI', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const baseURL = testInfo.project.use.baseURL || 'http://localhost:5173';
  const email = pickFromEnv('E2E_LOGIN_EMAILS');
  const password = pickFromEnv('E2E_LOGIN_PASSWORDS');
  const firstName = pickFromEnv('E2E_LOGIN_FIRST_NAMES');
  const lastName = pickFromEnv('E2E_LOGIN_LAST_NAMES');

  await page.goto('/');

  const authLink = page.locator('a[data-testid="landing-cta-primary"]');
  await expect(authLink).toBeVisible();
  await expect(authLink).toHaveAttribute('href', /oauth2\/authorize/);
  const authUrl = await authLink.getAttribute('href');
  expect(authUrl, 'Auth URL should be present on the CTA').toBeTruthy();

  await page.goto(authUrl);
  if (!page.url().includes('/auth/callback')) {
    try {
      let currentEmail = email;
      let authResult = await attemptLogin(page, currentEmail, password);

      if (authResult.type === 'error' && INVALID_CREDENTIALS_PATTERN.test(authResult.message)) {
        // Use a unique alias so locked/existing users do not block automated signup.
        currentEmail = buildSignupAliasEmail(email);
        const signupResult = await attemptSignup(page, currentEmail, password, firstName, lastName);
        if (signupResult.type === 'signup_not_reached') {
          throw new Error('Cognito signup page was not reached from login page. Check Hosted UI configuration.');
        }
        if (signupResult.type !== 'callback') {
          authResult = await attemptLogin(page, currentEmail, password);
        } else {
          authResult = signupResult;
        }
      }

      if (authResult.type === 'verification_required') {
        throw new Error(authResult.message);
      }

      if (authResult.type === 'error') {
        throw new Error(`Cognito sign-in failed: ${authResult.message}`);
      }
    } catch (error) {
      if (page.isClosed()) {
        throw new Error('Browser/page closed before login completed. Re-run and inspect trace for early browser teardown.');
      }
      throw error;
    }
  }

  const baseRegex = new RegExp(`${baseURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`);
  await page.waitForURL(baseRegex);
  await expect(page.getByTestId('landing-cta-primary')).toHaveAttribute('href', '/portfolios');
});
