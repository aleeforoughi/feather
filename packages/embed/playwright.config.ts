import { defineConfig, devices } from "@playwright/test"

// End to end: the built bundle in a copy of Godpip's page. Set CHROMIUM_PATH to use a Chromium that is already installed.
const port = Number(process.env.EMBED_PORT ?? 6010)

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `node e2e/serve.mjs ${port}`, port, reuseExistingServer: false },
})
