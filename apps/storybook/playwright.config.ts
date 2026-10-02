import { defineConfig, devices } from "@playwright/test"

// Visual regression: every story in every reference theme, against the baselines in visual/__screenshots__.
// STORYBOOK_DIR picks the built Storybook to serve (default: this app's storybook-static). Baselines are recorded
// in CI's Playwright container (.github/workflows/visual-baselines.yml), so run the suite there, or in
// mcr.microsoft.com/playwright:v1.63.0-noble, for a pixel-exact comparison.
const dir = process.env.STORYBOOK_DIR ?? "storybook-static"
const port = Number(process.env.STORYBOOK_PORT ?? 6007)

export default defineConfig({
  testDir: "visual",
  snapshotPathTemplate: `${process.env.SNAPSHOT_DIR ?? "{testDir}/__screenshots__"}/{arg}{ext}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { maxDiffPixels: 0, threshold: 0.1, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 } }],
  webServer: { command: `node visual/serve.mjs ${dir} ${port}`, port, reuseExistingServer: false },
})
