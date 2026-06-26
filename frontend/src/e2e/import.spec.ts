import { test, expect } from '@playwright/test';

test.describe('Import CSV', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
  });

  test('displays import form', async ({ page }) => {
    await expect(page.getByText('Import CSV')).toBeVisible();
  });

  test('validates CSV file upload', async ({ page }) => {
    // Create a test CSV file
    const testCsv = `Transaction Date,Description,Amount
2026-03-01,Starbucks,5.50
2026-03-02,Grocery Store,45.99`;

    // Write to a temporary file
    await page.evaluate(() => {
      (window as any).testCsvContent = testCsv;
    });

    // Test file selection
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(testCsv),
    });

    await expect(fileInput).toHaveValue('test.csv');
  });

  test('shows error for invalid CSV', async ({ page }) => {
    // Try to submit without file
    await page.getByRole('button', { name: 'Upload' }).click();

    // Should show error
    await expect(page.getByText(/error|missing/i)).toBeVisible();
  });
});

test.describe('Import Processing', () => {
  test('shows import progress', async ({ page }) => {
    await page.goto('/imports');

    // Wait for import status to load
    await expect(page.getByText('Import History').first(), { timeout: 10000 }).toBeVisible();
  });

  test('displays import status', async ({ page }) => {
    await page.goto('/imports');

    // Check for status indicators
    const statusIndicators = [
      'Total Rows',
      'Embedded',
      'Auto-Categorized',
      'Needs Review',
    ];

    for (const indicator of statusIndicators) {
      const hasIndicator = await page.getByText(indicator).count();
      expect(hasIndicator).toBeGreaterThan(0);
    }
  });
});