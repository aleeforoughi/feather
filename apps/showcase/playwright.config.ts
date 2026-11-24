import { defineConfig, devices } from "@playwright/test"

// The website layer's budgets (docs/visual-system.md section 14.4) on the built showcase sites: one page schema in three
// brands, on a throttled phone profile. Set CHROMIUM_PATH to use a Chromium that is already installed.
const port = Number(process.env.SITES_PORT ?? 6020)

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } }],
  webServer: { command: `npx vite preview --port ${port} --strictPort`, port, reuseExistingServer: false },
})
