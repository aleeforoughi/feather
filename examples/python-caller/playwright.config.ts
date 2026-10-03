import { defineConfig, devices } from "@playwright/test"

// The reference caller (server.py), driven end to end. Needs the embed bundle built (pnpm build) and python3.
// Set CHROMIUM_PATH to use a Chromium that is already installed.
const port = Number(process.env.CALLER_PORT ?? 6018)

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `python3 server.py --port ${port}`, port, reuseExistingServer: false },
})
