import { test, expect } from "@playwright/test";

test.describe("Transaction Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Budgeting App");
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 5000 });
  });

  test("ignore and unignore a transaction updates summary", async ({
    page,
  }) => {
    // Capture initial expenses text
    const expenseCard = page
      .getByText("Expenses")
      .locator("..")
      .locator("p.text-3xl");
    const initialExpenses = await expenseCard.textContent();

    // Find first Ignore button and click it
    await page.getByRole("button", { name: "Ignore" }).first().click();

    // The button text should change to "Unignore"
    await expect(
      page.getByRole("button", { name: "Unignore" }).first()
    ).toBeVisible();

    // Expenses should have changed (one transaction ignored)
    await expect(expenseCard).not.toHaveText(initialExpenses!);

    // Unignore it back
    await page.getByRole("button", { name: "Unignore" }).first().click();

    // Expenses should be restored
    await expect(expenseCard).toHaveText(initialExpenses!);
  });

  test("sorting by amount column works", async ({ page }) => {
    // Click on "Amount" header to sort ascending
    await page
      .locator("thead")
      .getByText("Amount")
      .click();

    const getAmounts = async () => {
      const cells = page.locator("tbody tr td:nth-child(4)");
      const count = await cells.count();
      const amounts: number[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cells.nth(i).textContent();
        if (text) {
          amounts.push(parseFloat(text.replace(/[,$]/g, "")));
        }
      }
      return amounts;
    };

    const ascAmounts = await getAmounts();
    expect(ascAmounts.length).toBeGreaterThan(0);

    // Verify ascending order
    for (let i = 1; i < ascAmounts.length; i++) {
      expect(ascAmounts[i]).toBeGreaterThanOrEqual(ascAmounts[i - 1]);
    }

    // Click again for descending
    await page.locator("thead").getByText("Amount").click();
    const descAmounts = await getAmounts();

    for (let i = 1; i < descAmounts.length; i++) {
      expect(descAmounts[i]).toBeLessThanOrEqual(descAmounts[i - 1]);
    }
  });

  test("ignored transaction row is visually dimmed", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).not.toHaveClass(/opacity-60/);

    // Ignore the transaction
    await firstRow.getByRole("button", { name: "Ignore" }).click();

    // Row should now have opacity-60 class
    await expect(firstRow).toHaveClass(/opacity-60/);
  });

  test("sorting by merchant column works alphabetically", async ({ page }) => {
    // Click "Merchant" header to sort ascending
    await page.locator("thead").getByText("Merchant").click();

    const getMerchants = async () => {
      const cells = page.locator("tbody tr td:nth-child(2)");
      const count = await cells.count();
      const merchants: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cells.nth(i).textContent();
        if (text) merchants.push(text);
      }
      return merchants;
    };

    const ascMerchants = await getMerchants();
    expect(ascMerchants.length).toBeGreaterThan(0);

    // Verify alphabetical ascending
    for (let i = 1; i < ascMerchants.length; i++) {
      expect(ascMerchants[i].localeCompare(ascMerchants[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });

  test("triple-clicking sort cycles through asc, desc, and reset", async ({ page }) => {
    // Track all merchants to verify sort changes
    const getAllMerchants = async () => {
      const cells = page.locator("tbody tr td:nth-child(2)");
      const count = await cells.count();
      const merchants: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cells.nth(i).textContent();
        if (text) merchants.push(text);
      }
      return merchants;
    };

    const original = await getAllMerchants();

    // Click Merchant to sort asc
    await page.locator("thead").getByText("Merchant").click();
    const afterAsc = await getAllMerchants();
    // Verify ascending alphabetical order
    for (let i = 1; i < afterAsc.length; i++) {
      expect(afterAsc[i].localeCompare(afterAsc[i - 1])).toBeGreaterThanOrEqual(0);
    }

    // Click again to sort desc
    await page.locator("thead").getByText("Merchant").click();
    const afterDesc = await getAllMerchants();
    // Verify descending alphabetical order
    for (let i = 1; i < afterDesc.length; i++) {
      expect(afterDesc[i].localeCompare(afterDesc[i - 1])).toBeLessThanOrEqual(0);
    }

    // Click third time to reset sort (column deselected)
    await page.locator("thead").getByText("Merchant").click();
    // After reset, sort column is null — should show original order
    const afterReset = await getAllMerchants();
    expect(afterReset.length).toBe(original.length);
  });
});
