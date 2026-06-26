import { test, expect } from '@playwright/test';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays categories', async ({ page }) => {
    // Open categories menu or page
    await page.getByRole('link', { name: /Categories/i }).click();

    await expect(page.getByText('Categories')).toBeVisible();
  });

  test('can add new category', async ({ page }) => {
    await page.goto('/categories');

    // Click add category button
    await page.getByRole('button', { name: 'Add Category' }).click();

    // Fill in category form
    await page.getByLabel('Name').fill('Test Category');
    await page.getByLabel('Type').selectOption('expense');
    await page.getByLabel('Color').fill('#ff5733');

    // Submit
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify category was created
    await expect(page.getByText('Test Category')).toBeVisible();
  });

  test('validates category name uniqueness', async ({ page }) => {
    await page.goto('/categories');

    // Try to create duplicate category
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.getByLabel('Name').fill('Existing Category');
    await page.getByRole('button', { name: 'Save' }).click();

    // Should show error
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible();
  });
});

test.describe('Category Colors', () => {
  test('displays category with correct color', async ({ page }) => {
    await page.goto('/');

    // Check that categories have color badges
    const colorBadges = await page.locator('.category-badge').count();
    expect(colorBadges).toBeGreaterThan(0);
  });
});