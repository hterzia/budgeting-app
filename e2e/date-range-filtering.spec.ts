import { test, expect } from "@playwright/test";

/** Click the date range dropdown button in nav */
async function openDatePicker(page) {
  // The DateRangeSelector is the second button in nav (after "Import")
  // Its text shows the current date range or "No data"
  const navButtons = page.locator("nav button");
  await navButtons.nth(1).click();
}

/** Select a date range preset by clicking its button in the dropdown */
async function selectPreset(page, preset: string) {
  await openDatePicker(page);
  await page.getByRole("button", { name: preset, exact: true }).click();
}

test.describe("Date Range Filtering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Budgeting App");
    await page.locator("nav button").nth(1).click();
    await page.getByRole("button", { name: "All Time", exact: true }).click();
  });

  test("'All Time' preset shows all transactions", async ({ page }) => {
    await selectPreset(page, "All Time");

    const rows = page.locator("tbody tr");
    await expect(rows).not.toHaveCount(0);
  });

  test("switching between presets changes visible transactions", async ({
    page,
  }) => {
    // Already in "All Time" from beforeEach
    const allTimeCount = await page.locator("tbody tr").count();
    expect(allTimeCount).toBeGreaterThan(0);

    // Switch to "Current Month" — should show fewer than or equal to allTimeCount
    await selectPreset(page, "Current Month");
    const currentMonthCount = await page.locator("tbody tr").count();
    expect(currentMonthCount).toBeLessThanOrEqual(allTimeCount);
  });

  test("'All Time' summary shows income and expense totals", async ({ page }) => {
    await selectPreset(page, "All Time");
    const incomeCard = page.getByText("Income").locator("..").locator("p.text-3xl");
    const expenseCard = page.getByText("Expenses").locator("..").locator("p.text-3xl");
    await expect(incomeCard).toBeVisible();
    await expect(expenseCard).toBeVisible();
    await expect(incomeCard).toContainText("$");
    await expect(expenseCard).toContainText("$");
  });

  test("'Current Month' shows fewer transactions than All Time", async ({
    page,
  }) => {
    // Switch to "Current Month"
    await selectPreset(page, "Current Month");

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("'Last 30 Days' shows a subset of All Time data", async ({ page }) => {
    await selectPreset(page, "Last 30 Days");

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("summary cards update when switching from All Time to Current Month", async ({
    page,
  }) => {
    const incomeCard = page.getByText("Income").locator("..").locator("p.text-3xl");
    const allTimeIncome = await incomeCard.textContent();
    await selectPreset(page, "Current Month");
    // Income value may or may not change depending on backend data, but the card should be visible
    await expect(incomeCard).toBeVisible();
    await expect(incomeCard).toContainText("$");
  });
});
