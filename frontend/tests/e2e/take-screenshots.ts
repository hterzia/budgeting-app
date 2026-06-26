import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const projectDir = '/path/to/budgeting-app';
const screenshotDir = path.join(projectDir, 'frontend', 'docs', 'mobile');

// Ensure directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function takeMobileScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Screenshot 1: Mobile landing page
    console.log('Screenshot 1: Mobile landing page');
    const screenshot1Path = path.join(screenshotDir, 'landing.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`Saved to: ${screenshot1Path}`);

    // Screenshot 2: Open menu
    console.log('Screenshot 2: Mobile menu open');
    await page.click('button[aria-label="Menu"]');
    await page.waitForTimeout(500);
    const screenshot2Path = path.join(screenshotDir, 'menu-open.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`Saved to: ${screenshot2Path}`);

    // Screenshot 3: Mobile insights
    console.log('Screenshot 3: Mobile insights page');
    await page.goto('http://localhost:3000/insights');
    await page.waitForTimeout(2000);
    const screenshot3Path = path.join(screenshotDir, 'insights.png');
    await page.screenshot({ path: screenshot3Path });
    console.log(`Saved to: ${screenshot3Path}`);

    // Screenshot 4: Desktop view
    console.log('Screenshot 4: Desktop view (1280x800)');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    const screenshot4Path = path.join(screenshotDir, 'desktop.png');
    await page.screenshot({ path: screenshot4Path });
    console.log(`Saved to: ${screenshot4Path}`);

    console.log('\nAll screenshots saved successfully!');
    console.log(`Screenshots saved to: ${screenshotDir}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

takeMobileScreenshots();
