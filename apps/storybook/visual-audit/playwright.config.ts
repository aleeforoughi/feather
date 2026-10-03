import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

// Gate 2, the rendered audit. It serves a built Storybook with the visual suite's own server (visual/serve.mjs), the
// same STORYBOOK_DIR and CHROMIUM_PATH handling, and lists stories from the same index.json.
//   pnpm --filter @feather-apps/storybook build && pnpm test:audit
// Projects: `selftest` (fixtures, proves each check fires) and `audit` (every story, both themes, three densities).
const here = path.dirname(fileURLToPath(import.meta.url))
const app = path.resolve(here, "..")
const dir = path.resolve(app, process.env.STORYBOOK_DIR ?? "storybook-static")
const port = Number(process.env.AUDIT_PORT ?? 6008)
const viewport = { width: 960, height: 720 }

export default defineConfig({
  testDir: here,
  outputDir: process.env.AUDIT_OUT ? path.join(process.env.AUDIT_OUT, "test-results") : path.join(app, "test-results/visual-audit"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"], [path.join(here, "reporter.ts")]],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport,
    deviceScaleFactor: 1,
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "selftest", testMatch: "selftest.spec.ts", use: { ...devices["Desktop Chrome"], viewport, deviceScaleFactor: 1 } },
    { name: "audit", testMatch: "audit.spec.ts", use: { ...devices["Desktop Chrome"], viewport, deviceScaleFactor: 1 } },
  ],
  webServer: { command: `node ${path.join(app, "visual/serve.mjs")} ${dir} ${port}`, port, reuseExistingServer: false },
})
