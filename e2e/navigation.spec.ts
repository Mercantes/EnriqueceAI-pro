import { expect, test } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('root should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test('all protected routes should redirect to login', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/leads',
      '/cadences',
      '/templates',
      '/reports',
      '/atividades',
      '/settings',
      '/settings/profile',
      '/settings/billing',
      '/settings/integrations',
      '/settings/users',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/login/, { timeout: 5000 });
    }
  });

  test('webhook endpoints should not redirect', async ({ request }) => {
    // Webhooks should return a response, not redirect
    const response = await request.get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test');
    expect(response.status()).toBe(403);
  });
});
