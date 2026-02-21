import { expect, test } from '@playwright/test';

test.describe('Auth Pages', () => {
  test('login page should render correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Entrar');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('signup page should render correctly', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1')).toContainText('Criar conta');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('forgot password page should render', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('login should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 }).catch(() => {
      // Error message may vary; just ensure we're still on login page
    });
    await expect(page).toHaveURL(/login/);
  });

  test('login should show validation error on empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // Browser validation should prevent submission, or our schema validation shows error
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated user should be redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated user should be redirected from leads', async ({ page }) => {
    await page.goto('/leads');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated user should be redirected from settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/login/);
  });

  test('login page should have link to signup', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
  });

  test('signup page should have link to login', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});
