import { chromium } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeMobileScreenshots() {
  console.log('Starting mobile screenshot capture...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // Wait for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Screenshot 1: Mobile landing page
    console.log('Capturing mobile landing page...');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('.text-2xl.font-bold', { timeout: 10000 });
    await page.screenshot({
      path: path.join(__dirname, 'mobile/landing.png'),
      fullPage: true
    });
    console.log('Saved: mobile/landing.png');

    // Screenshot 2: Mobile menu open
    console.log('Capturing mobile menu open...');
    await page.click('button[aria-label="Menu"]');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({
      path: path.join(__dirname, 'mobile/menu-open.png'),
      fullPage: true
    });
    console.log('Saved: mobile/menu-open.png');

    // Screenshot 3: Mobile spending summary
    console.log('Capturing spending summary...');
    await page.screenshot({
      path: path.join(__dirname, 'mobile/spending-summary.png'),
      fullPage: true
    });
    console.log('Saved: mobile/spending-summary.png');

    // Screenshot 4: Mobile insights page
    console.log('Capturing insights page...');
    await page.goto('http://localhost:3000/insights');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForSelector('h1:text("Insights")', { timeout: 10000 });
    await page.screenshot({
      path: path.join(__dirname, 'mobile/insights.png'),
      fullPage: true
    });
    console.log('Saved: mobile/insights.png');

    // Screenshot 5: Mobile insights empty state
    console.log('Capturing empty state...');
    await page.screenshot({
      path: path.join(__dirname, 'mobile/insights-empty.png'),
      fullPage: true
    });
    console.log('Saved: mobile/insights-empty.png');

    console.log('\nAll mobile screenshots generated successfully!');
    console.log('Screenshots saved to: frontend/docs/mobile/');
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeMobileScreenshots().catch(console.error);
