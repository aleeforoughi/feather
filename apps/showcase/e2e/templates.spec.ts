import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { devices, expect, test, type Browser, type Page } from "@playwright/test"

// Wave 5 part C, the six page templates (packages/page/templates/*.page.json), each in its own layout, served by the
// showcase at sites.html?template=<name>. In every brand each renders with its layout, one h1 and no errors, passes
// axe at the top and after scrolling through, stops moving under reduced motion, and meets the mobile budgets.
// Then the wave's exit test: the launch template at loudness 3 also holds without WebGL and with no script, as
// `feather-page build` writes it.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const BRANDS = ["studio", "portrait", "seed"]
const TEMPLATES = { launch: "poster", studio: "swiss", editorial: "editorial", service: "colour-blocking", product: "two-colour", creator: "brutalist" } as const
const templatePath = (name: string) => path.join(import.meta.dirname, `../../../packages/page/templates/${name}.page.json`)
const url = (name: string, brand: string) => `/sites.html?template=${name}&brand=${brand}`

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

/** Every heading of the template's sections, as the document has them (each block with a title shows it). */
function titles(name: string): string[] {
  const doc = JSON.parse(fs.readFileSync(templatePath(name), "utf8")) as { sections: { title?: string; block: string }[] }
  return doc.sections.filter((s) => typeof s.title === "string" && s.block !== "statement").map((s) => s.title!)
}

for (const [name, layout] of Object.entries(TEMPLATES)) {
  for (const brand of BRANDS) {
    test.describe(`template ${name}, ${brand}`, () => {
      test(`renders in the ${layout} layout with one h1 and no errors`, async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (e) => errors.push(e.message))
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
        await page.goto(url(name, brand), { waitUntil: "networkidle" })
        await expect(page.locator("main")).toHaveAttribute("data-layout", layout)
        await expect(page.locator("h1")).toHaveCount(1)
        for (const t of titles(name)) await expect(page.getByRole("heading", { name: t, exact: true }).first(), t).toBeAttached()
        // No section is wider than the screen, whatever the layout does to it.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await scrollThrough(page)
        expect(errors).toEqual([])
      })

      test("passes axe (WCAG 2.2 AA), at the top and after scrolling through", async ({ page }) => {
        await page.goto(url(name, brand), { waitUntil: "networkidle" })
        expect(await axe(page)).toEqual([])
        await scrollThrough(page)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(400)
        expect(await axe(page)).toEqual([])
      })

      test("stops moving under reduced motion", async ({ browser }) => {
        const context = await browser.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" })
        const page = await context.newPage()
        await page.goto(url(name, brand), { waitUntil: "networkidle" })
        await scrollThrough(page)
        // Reduced motion keeps a 150ms cross-fade for reveals: let every finite animation finish (2s at most), then
        // nothing may still be running. A loop never finishes, so it still fails here.
        await page.evaluate(() =>
          Promise.race([
            Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ])
        )
        expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0)
        await expect(page.locator('[data-slot="stage"][data-variant="pinned"]')).toHaveCount(0)
        await expect(page.locator('[data-slot="marquee"][data-state="playing"]')).toHaveCount(0)
        expect(await page.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.paused))).toBe(true)
        await context.close()
      })

      test("the mobile budgets (reported, and they must pass)", async ({ page }) => {
        await page.addInitScript(() => {
          const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }
          w.__vitals = { lcp: 0, cls: 0, tbt: 0 }
          new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
          new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.cls += (e as unknown as { hadRecentInput: boolean; value: number }).hadRecentInput ? 0 : (e as unknown as { value: number }).value))).observe({ type: "layout-shift", buffered: true })
          new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true })
        })
        const cdp = await page.context().newCDPSession(page)
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: budgets.cpuThrottle })
        await page.goto(url(name, brand), { waitUntil: "networkidle" })
        await page.waitForTimeout(1500)
        const v = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }).__vitals)
        test.info().annotations.push({ type: `vitals (${name}, ${brand}, mobile)`, description: JSON.stringify(v) })
        expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
        expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
        expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
      })
    })
  }
}

/** A desktop that passes the scene's capability gate, without WebGL. */
async function noWebgl(browser: Browser) {
  const context = await browser.newContext({ ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 8 })
    Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 8 })
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/i.test(type) ? null : (get as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  return context
}

/** The launch template as `feather-page build` writes it (bin/build.mjs, the CLI's own build), with the site's CSS. */
async function built(brand: string) {
  const lib = await import("@aleeforoughi/feather-page")
  const { buildPage } = await import("../../../packages/page/bin/build.mjs")
  const React = await import("react")
  const server = await import("react-dom/server")
  const r = lib.validatePage(JSON.parse(fs.readFileSync(templatePath("launch"), "utf8")))
  if (!r.ok) throw new Error("invalid template")
  const tokens = JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve(`@aleeforoughi/feather-tokens/themes/${brand}.json`), "utf8")).tokens
  const tmp = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : os.tmpdir()
  const out = fs.mkdtempSync(path.join(tmp, "feather-launch-"))
  const assets = path.join(import.meta.dirname, "../dist/assets")
  const css = fs.readdirSync(assets).find((f) => f.startsWith("sites-") && f.endsWith(".css"))!
  buildPage({ lib, React, server, page: r.page, tokens, out, css: `/assets/${css}` })
  const files = { index: fs.readFileSync(path.join(out, "index.html"), "utf8"), notFound: fs.readFileSync(path.join(out, "404.html"), "utf8") }
  fs.rmSync(out, { recursive: true, force: true })
  return files
}

test.describe("the exit test: launch at loudness 3", () => {
  for (const brand of BRANDS) {
    test(`${brand}: without WebGL the page is complete, its hero a poster, no canvas, no errors`, async ({ browser }) => {
      const context = await noWebgl(browser)
      const page = await context.newPage()
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
      await page.goto(url("launch", brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      await page.waitForTimeout(500)
      expect(await page.locator("main").getAttribute("data-loudness")).toBe("3")
      const layer = page.locator('[data-block="hero"] [data-slot="scene-layer"]')
      await expect(layer).toHaveAttribute("data-state", "poster")
      await expect(layer.locator('[data-slot="scene-poster"]')).toHaveCount(1)
      await expect(page.locator("canvas")).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1, name: "Wake up to a sunrise, every morning." })).toBeVisible()
      for (const t of titles("launch")) await expect(page.getByRole("heading", { name: t, exact: true }).first(), t).toBeAttached()
      expect(await axe(page)).toEqual([])
      expect(errors).toEqual([])
      await context.close()
    })

    test(`${brand}: with no script, as feather-page build writes it, every section reads and nothing waits on script`, async ({ browser }) => {
      const files = await built(brand)
      const context = await browser.newContext({ ...devices["Pixel 7"], javaScriptEnabled: false })
      await context.route("https://feather.test/**", (route) => {
        const file = new URL(route.request().url()).pathname
        if (file === "/") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: files.index })
        if (file === "/404.html") return route.fulfill({ status: 404, contentType: "text/html; charset=utf-8", body: files.notFound })
        return route.fulfill({ path: path.join(import.meta.dirname, file.startsWith("/media/") ? "../public" : "../dist", file) })
      })
      const page = await context.newPage()
      await page.goto("https://feather.test/")
      await expect(page.locator("main")).toHaveAttribute("data-layout", "poster")
      await expect(page.locator('[data-slot="loader"]')).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1, name: "Wake up to a sunrise, every morning." })).toBeVisible()
      for (const t of titles("launch")) await expect(page.getByRole("heading", { name: t, exact: true }).first(), t).toBeVisible()
      // The story's steps are stacked in reading order, each with its picture; the offer's prices are all there.
      for (const step of ["Dawn, at 6:30", "Sunrise, at 6:45", "Daylight, at 7:00"]) await expect(page.getByText(step, { exact: true }).first()).toBeVisible()
      await expect(page.getByText("£149").first()).toBeAttached()
      await expect(page.locator("canvas")).toHaveCount(0)
      await page.goto("https://feather.test/404.html")
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page is still asleep")
      await context.close()
    })
  }
})
