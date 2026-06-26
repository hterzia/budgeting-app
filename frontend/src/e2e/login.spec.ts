import { test, expect } from '@playwright/test';

test.describe('Login and Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the budgeting app landing page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Budgeting App' })).toBeVisible();
  });
});

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navigates to import page', async ({ page }) => {
    await page.getByRole('link', { name: 'Import' }).click();
    await expect(page).toHaveURL(/.*import/);
  });
});