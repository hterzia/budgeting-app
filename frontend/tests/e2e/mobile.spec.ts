import { test, expect } from '@playwright/test';

test.describe('Mobile Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('renders mobile layout on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    // Wait for page to load and check root element exists
    await page.waitForSelector('#root', { timeout: 10000 });

    // Check for mobile navigation container
    const mobileNav = page.locator('.min-h-screen');
    await expect(mobileNav).toBeVisible();

    // On mobile, menu button should be visible (desktop uses flex)
    const menuButton = page.locator('button[aria-label="Menu"]');
    await expect(menuButton).toBeVisible({ timeout: 5000 });
  });

  test('opens mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const menuButton = page.locator('button[aria-label="Menu"]');
    await menuButton.click({ timeout: 5000 });

    // After clicking, menu should be open (check for visible menu items)
    await page.waitForTimeout(500);

    // Menu should contain links
    const overviewLink = page.locator('a:has-text("Overview")');
    await expect(overviewLink).toBeVisible();
  });

  test('displays spending summary cards stacked', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for page to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Cards should be visible after loading
    const cards = page.locator('.bg-white.rounded-2xl');
    await cards.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('displays transaction list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for page to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Transaction list should be visible (mobile view)
    const listContainer = page.locator('.space-y-3');
    await listContainer.first().waitFor({ state: 'visible', timeout: 10000 });
  });
});

test.describe('Mobile Insights Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/insights');
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('renders widget grid on mobile', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Check header is visible
    const header = page.locator('h1');
    await expect(header).toBeVisible({ timeout: 5000 });
    const headerText = await header.textContent();
    expect(headerText).toContain('Insights');
  });

  test('displays empty state with add widget button', async ({ page }) => {
    await page.waitForSelector('#root', { timeout: 10000 });

    // Add Widget button should be visible
    const addButton = page.locator('button:has-text("Add Widget")');
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Responsive Layout', () => {
  test('renders desktop layout on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Desktop layout - check that the main layout container exists
    const mainLayout = page.locator('.min-h-screen');
    await expect(mainLayout).toBeVisible({ timeout: 5000 });

    // Desktop has the main content area with larger padding
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });
});

test.describe('Mobile Transaction List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('transaction list container exists', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('#root', { timeout: 10000 });

    // Transaction list container should exist (either empty or with transactions)
    const listContainer = page.locator('.space-y-3');
    await expect(listContainer).toBeVisible();
  });
});
