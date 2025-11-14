import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Login')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should show validation error for empty credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /login/i }).click();
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible();
  });

  test('should redirect back to intended page after login', async ({ page }) => {
    await page.goto('/?redirect=/dashboards');
    await expect(page).toHaveURL(/\/login.*redirect/);
  });
});

test.describe('Onboarding Flow', () => {
  test('should show onboarding form', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByText('Welcome to BI-Agent')).toBeVisible();
    await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
  });

  test('should navigate through onboarding steps', async ({ page }) => {
    await page.goto('/onboarding');
    
    await page.getByLabel('First Name').fill('John');
    await page.getByLabel('Last Name').fill('Doe');
    await page.getByRole('button', { name: /next/i }).click();
    
    await expect(page.getByText(/step 2 of 3/i)).toBeVisible();
    await page.getByRole('button', { name: /next/i }).click();
    
    await expect(page.getByText(/step 3 of 3/i)).toBeVisible();
    await expect(page.getByText(/john doe/i)).toBeVisible();
  });
});
