import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w @heatmap/api',
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 60_000,
      reuseExistingServer: !process.env['CI'],
      env: {
        DATABASE_URL:
          process.env['DATABASE_URL'] ??
          'postgres://heatmap:heatmap@127.0.0.1:5432/heatmap',
        HOST: '127.0.0.1',
        PORT: '3000',
        WEB_ORIGIN: 'http://127.0.0.1:4200',
      },
    },
    {
      command: 'npm run start -w @heatmap/web -- --host 127.0.0.1 --port 4200',
      url: 'http://127.0.0.1:4200',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
