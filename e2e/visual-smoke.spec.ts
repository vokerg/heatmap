import { expect, test } from '@playwright/test';

async function waitForMap(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.dataset['heatmapReady'] === 'true',
  );
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.waitForTimeout(1_000);
}

async function waitForSeededHeatmap(
  page: import('@playwright/test').Page,
): Promise<void> {
  await waitForMap(page);
  await expect(page.getByTestId('activity-count')).toHaveText('72');
}

test('regional heatmap produces an assessable overview artifact', async ({ page }, testInfo) => {
  await page.goto('/?visual=1&center=12.407,55.775&zoom=10.6');
  await waitForSeededHeatmap(page);

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
  await waitForSeededHeatmap(page);

  await page.screenshot({
    path: testInfo.outputPath('detail.png'),
    fullPage: true,
  });
});

test('imports a GPX file through the browser', async ({ page }) => {
  await page.goto('/?visual=1&center=12.407,55.775&zoom=12');
  await waitForMap(page);

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="heatmap-test">
      <trk>
        <name>Uploaded test ride</name>
        <type>cycling</type>
        <trkseg>
          <trkpt lat="55.7700" lon="12.4000"><time>2026-08-03T08:00:00Z</time></trkpt>
          <trkpt lat="55.7720" lon="12.4050"><time>2026-08-03T08:02:00Z</time></trkpt>
          <trkpt lat="55.7740" lon="12.4100"><time>2026-08-03T08:04:00Z</time></trkpt>
        </trkseg>
      </trk>
    </gpx>`;

  await page.getByTestId('activity-upload').setInputFiles({
    name: 'uploaded-test.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpx),
  });

  await expect(page.getByTestId('import-status')).toContainText('Imported 1 activity');
  await expect(page.getByTestId('activity-count')).toHaveText('73');
});
