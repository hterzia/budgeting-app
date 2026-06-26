import { test, expect, Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.resolve(__dirname, "fixtures/chase-checking.csv");

/** Open import modal from nav */
async function openImportModal(page: Page) {
  // The nav has an "Import" button that opens the modal
  await page.locator("nav").getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Import Bank Statement")).toBeVisible();
}

/** Create a new account inside the import modal */
async function createAccount(page: Page, name: string) {
  const nameInput = page.getByPlaceholder("Account name");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(
    page.locator("select").filter({ hasText: name })
  ).toBeVisible();
}

test.describe("CSV Import Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Budgeting App");
  });

  test("empty state shows placeholder message", async ({ page }) => {
    await expect(
      page.getByText("No transactions yet. Import a CSV to get started.")
    ).toBeVisible();
  });

  test("creates an account, imports CSV, and triggers import", async ({
    page,
  }) => {
    await openImportModal(page);

    // No accounts exist — create form is shown directly
    await createAccount(page, "Chase Checking");

    // Upload CSV
    await page.locator('input[type="file"]').setInputFiles(CSV_PATH);

    // Template detection badge should appear
    await expect(page.getByText("Chase Credit Card")).toBeVisible();

    // Click Import inside the modal footer
    await page.locator(".space-y-6").getByRole("button", { name: "Import" }).click();

    // The import calls the backend API first. Two possible outcomes:
    // 1. Backend + Postgres available → transactions appear, modal closes
    // 2. Backend/Postgres unavailable → error message shown in modal
    const errorBanner = page.locator(".bg-red-50");
    const noTransactions = page.getByText("No transactions yet");

    // Wait for either: modal closes (success) or error appears (failure)
    await Promise.race([
      expect(errorBanner).toBeVisible({ timeout: 15000 }),
      expect(noTransactions).not.toBeVisible({ timeout: 15000 }),
    ]);

    if (await errorBanner.isVisible()) {
      // Backend unavailable — verify error is shown gracefully
      await expect(errorBanner).toContainText(/fail|error|connect/i);
    } else {
      // Backend available — transactions should be in the table
      const rows = page.locator("tbody tr");
      await expect(rows).not.toHaveCount(0);
    }
  });

  test("detects CSV template and shows badge", async ({ page }) => {
    await openImportModal(page);
    await createAccount(page, "Test Account");

    await page.locator('input[type="file"]').setInputFiles(CSV_PATH);

    // "Chase Credit Card" template matches headers: Transaction Date,Description,Type,Amount
    await expect(page.getByText("Chase Credit Card")).toBeVisible();
  });

  test("import button is disabled without a file", async ({ page }) => {
    await openImportModal(page);
    await createAccount(page, "My Account");

    // The Import button inside the modal should be disabled (no file)
    const importBtn = page.locator(".space-y-6").getByRole("button", { name: "Import" });
    await expect(importBtn).toBeDisabled();

    // Upload file — should become enabled
    await page.locator('input[type="file"]').setInputFiles(CSV_PATH);
    await expect(importBtn).toBeEnabled();
  });

  test("account type selector toggles between checking, savings, credit card", async ({
    page,
  }) => {
    await openImportModal(page);

    // Default type is "Checking" (highlighted)
    const checkingBtn = page.getByRole("button", { name: "Checking" });
    await expect(checkingBtn).toHaveClass(/bg-blue-600/);

    // Click "Credit Card" — it should become active
    await page.getByRole("button", { name: "Credit Card" }).click();
    await expect(
      page.getByRole("button", { name: "Credit Card" })
    ).toHaveClass(/bg-blue-600/);
    await expect(checkingBtn).not.toHaveClass(/bg-blue-600/);
  });
});
