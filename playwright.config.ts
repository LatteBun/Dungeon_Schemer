import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["line"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --webpack -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
