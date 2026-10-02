import fs from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

// Every story, in each reference theme. The story list comes from the built Storybook's index.json.
const dir = path.resolve(process.env.STORYBOOK_DIR ?? "storybook-static")
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as {
  entries: Record<string, { id: string; type: string }>
}
const stories = Object.values(index.entries)
  .filter((entry) => entry.type === "story")
  .map((entry) => entry.id)
  .sort()
const THEMES = ["paper-sharp", "void-pill"]

for (const theme of THEMES) {
  test.describe(theme, () => {
    for (const id of stories) {
      test(id, async ({ page }) => {
        await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`)
        await page.locator("#storybook-root > *").first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        // Let mount effects and entry transitions (theme motion, reduced to none) settle.
        await page.waitForTimeout(400)
        await expect(page).toHaveScreenshot(`${theme}/${id}.png`)
      })
    }
  })
}
