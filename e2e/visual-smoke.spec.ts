import { expect, test } from '@playwright/test';

async function waitForHeatmap(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset['heatmapReady'] === 'true');
  await expect(page.getByTestId('activity-count')).toHaveText('72');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.waitForTimeout(1_000);
}

test('regional heatmap produces an assessable overview artifact', async ({ page }, testInfo) => {
  await page.goto('/?visual=1&center=12.407,55.775&zoom=10.6');
  await waitForHeatmap(page);

  const canvas = page.locator('.maplibregl-canvas');
  const dimensions = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }));
  expect(dimensions.width).toBeGreaterThan(1_000);
  expect(dimensions.height).toBeGreaterThan(500);

  await page.screenshot({
    path: testInfo.outputPath('overview.png'),
    fullPage: true,
  });
});

test('street heatmap produces an assessable detail artifact', async ({ page }, testInfo) => {
  await page.goto('/?visual=1&center=12.418,55.769&zoom=15.2');
  await waitForHeatmap(page);

  await page.screenshot({
    path: testInfo.outputPath('detail.png'),
    fullPage: true,
  });
});
