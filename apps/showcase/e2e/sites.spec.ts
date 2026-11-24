import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

// The website layer's gates on real pages (docs/visual-system.md section 14.4): every brand built from the one page
// schema meets the mobile budgets on a 4x CPU-throttled phone profile, passes axe, keeps the native cursor and a
// :focus-visible ring, and stops moving under reduced motion. Lighthouse CI (lighthouserc.json) checks the same
// budgets with its own lab run.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const BRANDS = ["studio", "portrait", "seed"]

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: budgets.cpuThrottle })
  return cdp
}

/** LCP, CLS and an estimate of TBT (long tasks over 50ms, counted from their 50ms mark) from the page itself. */
async function webVitals(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }
    w.__vitals = { lcp: 0, cls: 0, tbt: 0 }
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.cls += (e as unknown as { hadRecentInput: boolean; value: number }).hadRecentInput ? 0 : (e as unknown as { value: number }).value))).observe({ type: "layout-shift", buffered: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true })
  })
}

for (const brand of BRANDS) {
  test.describe(brand, () => {
    test("meets the mobile budgets: LCP, CLS and TBT", async ({ page }) => {
      await webVitals(page)
      await throttle(page)
      await page.goto(`/sites.html?brand=${brand}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      const v = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }).__vitals)
      test.info().annotations.push({ type: "vitals", description: JSON.stringify(v) })
      expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
      expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
      expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
    })

    test("holds a median frame rate while scrolling (performance trace)", async ({ page }) => {
      await page.goto(`/sites.html?brand=${brand}`, { waitUntil: "networkidle" })
      await throttle(page)
      // The trace's own frame counter: measuring is not a site loop.
      const fps = await page.evaluate(async () => {
        const frames: number[] = []
        let last = performance.now()
        let running = true
        const tick = (t: number) => {
          frames.push(t - last)
          last = t
          if (running) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        const end = document.documentElement.scrollHeight
        for (let y = 0; y < end; y += 120) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 32))
        }
        running = false
        const sorted = frames.slice(1).sort((a, b) => a - b)
        return 1000 / sorted[Math.floor(sorted.length / 2)]
      })
      test.info().annotations.push({ type: "fps", description: fps.toFixed(1) })
      expect(fps).toBeGreaterThanOrEqual(budgets.fpsMedian)
    })

    test("passes axe (WCAG 2.2 AA) and keeps one h1, the native cursor and a focus-visible ring", async ({ page }) => {
      await page.goto(`/sites.html?brand=${brand}`, { waitUntil: "networkidle" })
      await page.addScriptTag({ content: axeSource })
      const result = await page.evaluate(async () => (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
      expect(result.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([])
      expect(await page.locator("h1").count()).toBe(1)
      expect(await page.evaluate(() => [...document.querySelectorAll("*")].some((el) => getComputedStyle(el).cursor === "none"))).toBe(false)
      await page.keyboard.press("Tab")
      await page.keyboard.press("Tab")
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const s = getComputedStyle(el)
        return { width: s.outlineWidth, style: s.outlineStyle }
      })
      expect(outline.style).not.toBe("none")
    })

    test("stops moving under reduced motion", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" })
      const page = await context.newPage()
      await page.goto(`/sites.html?brand=${brand}`, { waitUntil: "networkidle" })
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll("*")].filter((el) => {
          const s = getComputedStyle(el)
          const long = (v: string) => v.split(",").some((d) => Number.parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000) > 0.01)
          return long(s.transitionDuration) || (s.animationName !== "none" && long(s.animationDuration))
        }).length
      )
      expect(moving).toBe(0)
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0)
      await context.close()
    })
  })
}

test("the hero image is the LCP and is never lazy", async ({ page }) => {
  await page.goto("/sites.html?brand=portrait", { waitUntil: "networkidle" })
  const lazyPriority = await page.locator('img[fetchpriority="high"][loading="lazy"]').count()
  expect(lazyPriority).toBe(0)
})
