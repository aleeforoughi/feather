import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

// The loud reference page (packages/page/examples/studio-of-one-loud.page.json): loudness 3, every expressive variant
// (film hero, marquee, stack, fill, pinned process, scale case, rail, swap, horizontal timeline, colour blocks). In
// every brand it passes axe, stops moving under reduced motion and logs no errors. Its mobile budgets are measured
// and reported in the test's annotations, and they must still pass.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const BRANDS = ["studio", "portrait", "seed"]
const url = (brand: string) => `/sites.html?page=loud&brand=${brand}`

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(async () => (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
  return result.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)
}

/** Scrolls the whole page in steps, so every scroll-driven block has run once. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const end = document.documentElement.scrollHeight
    for (let y = 0; y < end; y += 300) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 30))
    }
    window.scrollTo(0, 0)
  })
}

for (const brand of BRANDS) {
  test.describe(`loud, ${brand}`, () => {
    test("renders every expressive variant with one h1 and no errors", async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
      await page.goto(url(brand), { waitUntil: "networkidle" })
      expect(await page.locator("main").getAttribute("data-loudness")).toBe("3")
      for (const v of ["film", "marquee", "stack", "fill", "pinned", "scale", "rail", "swap", "horizontal", "lead", "table"]) {
        await expect(page.locator(`[data-block-variant="${v}"]`).first(), v).toBeAttached()
      }
      await expect(page.locator("h1")).toHaveCount(1)
      await scrollThrough(page)
      expect(errors).toEqual([])
    })

    test("passes axe (WCAG 2.2 AA), at the top and after scrolling through", async ({ page }) => {
      await page.goto(url(brand), { waitUntil: "networkidle" })
      expect(await axe(page)).toEqual([])
      await scrollThrough(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(400)
      expect(await axe(page)).toEqual([])
    })

    test("stops moving under reduced motion, every block resting in reading order", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" })
      const page = await context.newPage()
      await page.goto(url(brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      // Reduced motion keeps a 150ms cross-fade for reveals (docs/visual-system.md §14.2): let every finite animation
      // finish (2s at most), then nothing may still be running. A loop (an infinite animation) never finishes, so it
      // still fails here.
      await page.evaluate(() =>
        Promise.race([
          Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ])
      )
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll("*")].filter((el) => {
          const s = getComputedStyle(el)
          const long = (v: string) => v.split(",").some((d) => Number.parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000) > 0.01)
          return long(s.transitionDuration) || (s.animationName !== "none" && long(s.animationDuration))
        }).length
      )
      expect(moving).toBe(0)
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0)
      await expect(page.locator('[data-slot="scroll-layers"][data-state="scrub"]')).toHaveCount(0)
      await expect(page.locator('[data-slot="stage"][data-variant="pinned"]')).toHaveCount(0)
      await expect(page.locator('[data-slot="marquee"][data-state="playing"]')).toHaveCount(0)
      await context.close()
    })
  })
}

test("loud, studio: the mobile budgets (reported, and they must pass)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }
    w.__vitals = { lcp: 0, cls: 0, tbt: 0 }
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.cls += (e as unknown as { hadRecentInput: boolean; value: number }).hadRecentInput ? 0 : (e as unknown as { value: number }).value))).observe({ type: "layout-shift", buffered: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true })
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: budgets.cpuThrottle })
  await page.goto(url("studio"), { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  const v = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }).__vitals)
  test.info().annotations.push({ type: "vitals (loud, mobile)", description: JSON.stringify(v) })
  expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
  expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
  expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
})
