import { defineConfig, devices } from "@playwright/test"

// End to end: the built docs site, served statically. Set CHROMIUM_PATH to use a Chromium that is already installed.
const port = Number(process.env.DOCS_PORT ?? 6009)

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `node e2e/serve.mjs dist ${port}`, port, reuseExistingServer: false },
})
