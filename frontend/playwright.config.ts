import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Two servers: the dev one for everything, plus a production build on 3002
  // for the offline tests. `next dev` generates JS chunks on demand and never
  // serves the same URLs twice, so the service worker cannot cache an app
  // shell that hydrates — offline is only meaningful against a real build.
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm build && pnpm exec next start --port 3002',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
