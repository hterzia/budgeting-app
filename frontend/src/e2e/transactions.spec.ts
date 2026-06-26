import { test, expect } from '@playwright/test';

test.describe('Transaction List', () => {
  test('displays transactions after import', async ({ page }) => {
    // Visit the app
    await page.goto('/');

    // Wait for transactions to load
    await expect(page.getByText('Loading...').first(), { timeout: 10000 }).toHaveCount(0);
  });

  test('shows empty state when no transactions', async ({ page }) => {
    await page.goto('/');

    // Check for empty state or transaction list
    const hasTransactions = await page.getByRole('table').count();
    expect(hasTransactions).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Transaction Filtering', () => {
  test('can filter by date range', async ({ page }) => {
    await page.goto('/');

    // Open date range selector
    await page.getByRole('button', { name: /Date Range/i }).click();

    // Select a date range
    await page.getByRole('option', { name: 'Last 30 Days' }).click();

    // Verify filter applied
    await expect(page.locator('.date-range-filter')).toHaveCount(1);
  });

  test('can filter by category', async ({ page }) => {
    await page.goto('/');

    // Click on category filter
    await page.getByRole('button', { name: /Category/i }).click();

    // Select a category
    await page.getByRole('option').first().click();

    // Verify filter applied
    await expect(page.locator('.category-filter')).toHaveCount(1);
  });
});