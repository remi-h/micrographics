import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Optional override for sandboxes with a pre-installed Chromium build that
          // doesn't match the pinned @playwright/test version. Unset in CI, where
          // `npx playwright install --with-deps chromium` provides a matching binary.
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
        },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Accounts are on for the suite, pointed at an address on the app's own
    // origin that nothing serves: the account specs answer those requests
    // themselves (see e2e/account.ts), and a signed-out editor sends none.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${PORT}/supabase`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-key',
    },
    timeout: 120_000,
  },
});
