import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

// Runs every story as a test in a real browser: it must render without errors and pass axe (WCAG 2.2 AA rules),
// once per reference theme. FEATHER_THEME picks the theme; CI runs both.
const executablePath = process.env.CHROMIUM_PATH

export default defineConfig({
  plugins: [react(), tailwindcss(), storybookTest({ configDir: ".storybook" })],
  define: { "import.meta.env.FEATHER_THEME": JSON.stringify(process.env.FEATHER_THEME ?? "paper-sharp") },
  test: {
    name: "storybook",
    setupFiles: [".storybook/vitest.setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      // Reduced motion: entry fades finish at once, so axe never measures a half-faded color.
      provider: playwright({ contextOptions: { reducedMotion: "reduce" }, ...(executablePath ? { launchOptions: { executablePath } } : {}) }),
      instances: [{ browser: "chromium" }],
    },
  },
})
