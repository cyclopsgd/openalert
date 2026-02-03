import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // For these tests, we'll test public pages or unauthenticated state
    await page.goto('/');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Root should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/OpenAlert/);
  });

  test('should navigate using browser back/forward', async ({ page }) => {
    // Start at login
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    // Navigate away (could be to register, or any public page)
    // For now, just test browser navigation works
    await page.goBack();
    await page.goForward();

    // Should still be functional
    await expect(page.getByRole('heading', { name: 'OpenAlert' })).toBeVisible();
  });

  test('should handle deep linking', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/incidents');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should have responsive layout', async ({ page }) => {
    await page.goto('/login');

    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: 'OpenAlert' })).toBeVisible();

    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('heading', { name: 'OpenAlert' })).toBeVisible();

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'OpenAlert' })).toBeVisible();
  });
});
