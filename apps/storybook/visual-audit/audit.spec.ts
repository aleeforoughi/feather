import fs from "node:fs"
import path from "node:path"
import { test } from "@playwright/test"
import { fromEngine, HERE, loadThemes } from "./expected"
import { applyExceptions, loadExceptions } from "./exceptions"
import { runAudit } from "./run"
import type { Row } from "./run"

// Every story, in each reference theme and each density. The story list comes from the built Storybook's index.json.
const dir = path.resolve(HERE, "..", process.env.STORYBOOK_DIR ?? "storybook-static")
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as { entries: Record<string, { id: string; type: string }> }
const stories = Object.values(index.entries)
  .filter((e) => e.type === "story")
  .map((e) => e.id)
  .sort()
const only = process.env.AUDIT_STORY ? new RegExp(process.env.AUDIT_STORY) : null
// AUDIT_OUT lets several audits run side by side without sharing results.
const results = path.join(process.env.AUDIT_OUT ?? HERE, ".results")
const exceptions = loadExceptions()
const expected = await fromEngine()

for (const theme of loadThemes(expected)) {
  test.describe(theme.name, () => {
    for (const id of stories.filter((s) => !only || only.test(s))) {
      test(id, async ({ page }) => {
        let rows: Row[]
        await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme.name}`)
        const rendered = await page
          .locator("#storybook-root > *")
          .first()
          .waitFor({ timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
        if (!rendered) {
          rows = [{ rule: "harness.render", property: "render", slot: "(none)", selector: "#storybook-root", expected: "the story renders", actual: "nothing rendered in 15s", story: id, theme: theme.name, density: "-" }]
        } else {
          await page.evaluate(() => document.fonts.ready)
          // Storybook's centered layout can put a story on a half pixel; the audit measures the component, not that.
          await page.addStyleTag({ content: ".sb-main-centered{display:block!important}" })
          rows = await runAudit(page, { story: id, theme, controlHeight: expected.controlHeight })
        }
        const { rows: left, exempted } = applyExceptions(rows, exceptions.entries)
        fs.mkdirSync(results, { recursive: true })
        fs.writeFileSync(path.join(results, `${theme.name}__${id}.json`), JSON.stringify({ story: id, theme: theme.name, exempted, ignoredExceptions: exceptions.ignored, rows: left }))
        if (left.length) {
          const byRule: Record<string, number> = {}
          for (const r of left) byRule[r.rule] = (byRule[r.rule] ?? 0) + 1
          throw new Error(`${left.length} violations: ${Object.entries(byRule).map(([k, v]) => `${k} x${v}`).join(", ")} (first: ${left[0].rule} on ${left[0].slot} ${left[0].selector}, expected ${left[0].expected}, actual ${left[0].actual})`)
        }
      })
    }
  })
}
