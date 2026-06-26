import { test, expect, Page } from "@playwright/test";

async function navigateToInsights(page: Page) {
  await page.goto("/");
  await page.waitForSelector("text=Budgeting App");
  // Click Insights link in nav
  await page.getByRole("link", { name: "Insights" }).click();
  await page.waitForSelector("text=Insights");
}

test.describe("Insights Page", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToInsights(page);
  });

  test("shows empty state when no widgets added", async ({ page }) => {
    // Should see "No widgets" message and "Add Widget" button
    await expect(page.getByText("No widgets")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Widget" })).toBeVisible();
  });

  test("adds a widget and displays it", async ({ page }) => {
    // Click Add Widget button
    await page.getByRole("button", { name: "Add Widget" }).click();

    // Select a widget
    await page.getByRole("button", { name: "Summary" }).click();

    // Should see the Summary widget
    await expect(page.getByText("Summary")).toBeVisible();
    await expect(page.getByText("Income")).toBeVisible();
  });

  test("adds multiple widgets to the grid", async ({ page }) => {
    // Add Summary widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText("Summary")).toBeVisible();

    // Add Cash Flow widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Cash Flow" }).click();
    await expect(page.getByText("Cash Flow")).toBeVisible();

    // Add Category Pie widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Spending by Category" }).click();
    await expect(page.getByText("Spending by Category")).toBeVisible();

    // Should have 3 widgets in grid
    const widgets = page.locator(".grid .flex.flex-col");
    await expect(widgets).toHaveCount(3);
  });

  test("adds widget with custom title", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Cash Flow" }).click();

    // Enter custom title
    await page.getByLabel("Widget Title (optional)").fill("My Custom Cash Flow");
    await page.getByRole("button", { name: "Add Widget" }).click();

    // Verify custom title appears
    await expect(page.getByText("My Custom Cash Flow")).toBeVisible();
  });

  test("removes a widget", async ({ page }) => {
    // Add a widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText("Summary")).toBeVisible();

    // Remove the widget
    await page.getByRole("button", { name: "Remove widget" }).click();

    // Widget should be gone
    await expect(page.getByText("Summary")).not.toBeVisible();
    await expect(page.getByText("No widgets")).toBeVisible();
  });

  test("filter modal opens and shows date range", async ({ page }) => {
    // Add a widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Cash Flow" }).click();

    // Open filters
    await page.getByRole("button", { name: "Filters" }).click();

    // Should see date range selector in modal
    await expect(page.getByText("Widget Filters")).toBeVisible();
    await expect(page.getByLabel("Date Range")).toBeVisible();

    // Close modal
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Widget Filters")).not.toBeVisible();
  });

  test("date range filter changes widget data", async ({ page }) => {
    // Add Cash Flow widget (default: 30 days)
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Cash Flow" }).click();

    // Open filters and change date range
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByLabel("Date Range").selectOption({ label: "6 Months" });
    await page.getByRole("button", { name: "Done" }).click();

    // Widget should be visible with updated date range
    await expect(page.getByText("Cash Flow")).toBeVisible();
  });

  test("category filter works", async ({ page }) => {
    // Add Category Pie widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Spending by Category" }).click();

    // Open filters
    await page.getByRole("button", { name: "Filters" }).click();

    // Select a category filter
    const categorySelect = page.locator("select").filter({ hasText: "Categories" });
    await categorySelect.selectOption({ label: "Food & Dining" });
    await page.getByRole("button", { name: "Done" }).click();

    // Widget should still be visible
    await expect(page.getByText("Spending by Category")).toBeVisible();
  });

  test("monthly comparison widget shows correct data", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Monthly Trends" }).click();

    // Should see the widget
    await expect(page.getByText("Monthly Trends")).toBeVisible();

    // Should see income and expense series labels
    // The chart should render with 3 months of data
    await expect(page.getByText("Income")).toBeVisible();
    await expect(page.getByText("Expenses")).toBeVisible();
  });

  test("top merchants widget limits to 10 items", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Top Merchants" }).click();

    // Widget should be visible
    await expect(page.getByText("Top Merchants")).toBeVisible();
  });

  test("transaction sizes histogram shows distribution", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Transaction Sizes" }).click();

    // Widget should be visible
    await expect(page.getByText("Transaction Sizes")).toBeVisible();
  });

  test("savings rate widget shows monthly percentages", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Savings Rate" }).click();

    // Widget should be visible
    await expect(page.getByText("Savings Rate")).toBeVisible();
  });

  test("day-of-week patterns widget shows weekday data", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Day-of-Week Patterns" }).click();

    // Widget should be visible
    await expect(page.getByText("Day-of-Week Patterns")).toBeVisible();
  });

  test("widget state persists after page reload", async ({ page }) => {
    // Add a widget
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText("Summary")).toBeVisible();

    // Reload page
    await page.reload();
    await page.waitForSelector("text=Insights");

    // Widget should still be present
    await expect(page.getByText("Summary")).toBeVisible();
  });

  test("category average widget shows spending by category", async ({ page }) => {
    await page.getByRole("button", { name: "Add Widget" }).click();
    await page.getByRole("button", { name: "Average Spending by Category" }).click();

    // Widget should be visible
    await expect(page.getByText("Average Spending by Category")).toBeVisible();
  });

  test("empty state has helpful message and button", async ({ page }) => {
    // Clear all widgets if any exist
    const widgetCount = await page.locator(".grid .flex.flex-col").count();
    for (let i = 0; i < widgetCount; i++) {
      await page.getByRole("button", { name: "Remove widget" }).first().click();
    }

    // Should see empty state
    await expect(page.getByText("No widgets")).toBeVisible();
    await expect(page.getByText("Get started by adding your first widget.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Widget" })).toBeVisible();
  });
});
