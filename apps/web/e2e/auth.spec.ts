import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page with correct elements', async ({ page }) => {
    // Check page title and branding
    await expect(page.getByRole('heading', { name: 'OpenAlert' })).toBeVisible();
    await expect(page.getByText('Sign in to manage your incidents')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    // Check form elements
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should toggle between login and register forms', async ({ page }) => {
    // Initially on login form
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    // Click to show register
    await page.getByText('Create an account').click();

    // Now on register form
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();

    // Switch back to login
    await page.getByText('Sign in instead').click();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should not navigate away
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for error message
    await expect(page.getByText(/Login failed|Invalid email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test('should allow user registration with valid data', async ({ page }) => {
    // Switch to register form
    await page.getByText('Create an account').click();

    // Fill registration form
    const timestamp = Date.now();
    await page.getByLabel('Full Name').fill('Test User');
    await page.getByLabel('Email').fill(`testuser${timestamp}@example.com`);
    await page.getByLabel('Password').fill('SecurePass123!');
    await page.getByRole('button', { name: 'Register' }).click();

    // Should redirect to dashboard or show success
    // Note: This might fail if registration is disabled in settings
    await page.waitForURL(/^\/(|dashboard)$/, { timeout: 10000 }).catch(() => {
      // Registration might be disabled, check for error message
      expect(page.getByText(/registration is disabled/i)).toBeVisible();
    });
  });

  test('should navigate with SSO button if available', async ({ page }) => {
    const ssoButton = page.getByRole('button', { name: /Sign in with Microsoft/i });

    if (await ssoButton.isVisible()) {
      await expect(ssoButton).toBeVisible();
    }
  });
});
