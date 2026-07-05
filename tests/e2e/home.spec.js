const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_PATH = path.join(__dirname, '../../docs/screenshots/home.png');

async function captureReadmeScreenshot(page) {
  await expect(page.locator('.header')).toBeVisible();

  const clip = await page.evaluate(() => {
    const padding = 32; // body padding (2rem)
    const header = document.querySelector('.header');
    const main = document.querySelectorAll('.controls, #list');

    if (!header) {
      throw new Error('Missing .header element for README screenshot crop');
    }

    const headerRect = header.getBoundingClientRect();
    let bottom = headerRect.bottom;
    let left = Infinity;
    let right = -Infinity;

    for (const node of main) {
      const rect = node.getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }

    return {
      x: Math.max(0, left - padding),
      y: Math.max(0, headerRect.top - padding),
      width: right - left + padding * 2,
      height: bottom - headerRect.top + padding * 2,
    };
  });

  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await page.screenshot({ path: SCREENSHOT_PATH, clip });
}

test.describe('home page', () => {
  test('renders mock projects from fixtures', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '📁 Projects' })).toBeVisible();
    await expect(page.locator('.project-row .name')).toHaveCount(5);
    await expect(page.getByText('project-viewer')).toBeVisible();
    await expect(page.getByText('api-gateway')).toBeVisible();
    await expect(page.getByText('docs-site')).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next.js' })).toBeVisible();
  });

  test('filters projects by tech pill', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Python' }).click();

    await expect(page.locator('.project-row .name')).toHaveCount(1);
    await expect(page.getByText('ml-pipeline')).toBeVisible();
    await expect(page.getByText('project-viewer')).not.toBeVisible();
  });

  test('captures README screenshot when UPDATE_README_SCREENSHOT=1', async ({ page }) => {
    test.skip(!process.env.UPDATE_README_SCREENSHOT, 'Set UPDATE_README_SCREENSHOT=1 to refresh docs/screenshots/home.png');

    await page.goto('/');
    await expect(page.locator('.project-row .name').first()).toBeVisible();

    await captureReadmeScreenshot(page);
    expect(fs.existsSync(SCREENSHOT_PATH)).toBe(true);
  });
});
