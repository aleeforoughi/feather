import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

// Wave 4's scenes on real pages: the loud reference page puts a shader behind its interactive hero and a product to turn
// in a case (a GLB made by scripts/make-model.mjs). In every brand: the poster shows first and the canvas only once it
// has drawn; without WebGL or under reduced motion the page is complete with its posters and no canvas; a page without
// a Three.js scene never requests the Three.js chunk (and the loud page only once its model nears the view); the
// hotspots are named buttons the keyboard reaches; and the mobile budgets still hold. Last, a page built by
// `feather-page build --runtime` loads the release's Three.js chunk from beside the runtime.
//
// The scenes run only where the capability gate allows (a fine pointer, more than 4 cores and 4 GB, WebGL, no data
// saver, no reduced motion), so the scene tests use a desktop context that reports 8 cores and 8 GB: the phone profile
// the budgets run on is turned away by the gate, and its posters are what it measures. Headless Chromium draws WebGL in
// software (SwiftShader) and reads every frame back to composite it, so the desktop is small and a scene that has shown
// what it must is paused (its own control) before the next one runs.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const BRANDS = ["studio", "portrait", "seed"]
const loud = (brand: string) => `/sites.html?page=loud&brand=${brand}`
const reference = (brand: string) => `/sites.html?brand=${brand}`
/** The showcase's Three.js chunk (Vite names it after its module) and the release's. */
const THREE_CHUNK = /\/assets\/three-[\w-]+\.js(?:\?|$)|\/feather-page-three\.js(?:\?|$)/
const LABELS = ["Status light", "Twist bezel", "Steel clip"]

interface DesktopOptions {
  webgl?: boolean
  reducedMotion?: "reduce" | "no-preference"
}

/** A desktop that passes the capability gate (unless WebGL is taken away), recording every request. */
async function desktop(browser: Browser, { webgl = true, reducedMotion = "no-preference" }: DesktopOptions = {}) {
  const context = await browser.newContext({ ...devices["Desktop Chrome"], viewport: { width: 960, height: 600 }, reducedMotion })
  await context.addInitScript((withWebgl: boolean) => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 8 })
    Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 8 })
    if (!withWebgl) {
      const get = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/i.test(type) ? null : (get as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest)
      } as typeof HTMLCanvasElement.prototype.getContext
    }
  }, webgl)
  const requests: string[] = []
  context.on("request", (r) => requests.push(r.url()))
  const errors: string[] = []
  const page = await context.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  return { context, page, requests, errors, three: () => requests.filter((u) => THREE_CHUNK.test(u)) }
}

/** Records the World of a scene layer every time it changes: its state, whether its poster shows, and its canvas. */
async function recordWorld(context: BrowserContext, kind: string) {
  await context.addInitScript((variant: string) => {
    const w = window as unknown as { __world: Record<string, unknown>[] }
    w.__world = []
    const snap = () => {
      const world = document.querySelector(`[data-slot="scene-layer"][data-variant="${variant}"] [data-slot="world"]`)
      if (!world) return
      const still = world.querySelector('[data-slot="world-still"]')
      const canvas = world.querySelector("canvas")
      const s = {
        state: world.getAttribute("data-state"),
        poster: !!still?.querySelector('[data-slot="scene-poster"]'),
        posterShown: !!still && !still.classList.contains("invisible"),
        canvas: !!canvas,
        canvasShown: !!canvas && canvas.classList.contains("opacity-100"),
      }
      const last = w.__world[w.__world.length - 1]
      if (JSON.stringify(last) !== JSON.stringify(s)) w.__world.push(s)
    }
    new MutationObserver(snap).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "class"] })
  }, kind)
}

const worldLog = (page: Page) => page.evaluate(() => (window as unknown as { __world: { state: string; poster: boolean; posterShown: boolean; canvas: boolean; canvasShown: boolean }[] }).__world)

/** The order a scene must keep: the poster first, a hidden canvas while it has not drawn, then the canvas over it. */
function expectPosterFirst(log: Awaited<ReturnType<typeof worldLog>>) {
  expect(log.length, JSON.stringify(log)).toBeGreaterThan(1)
  expect(log[0], "the first thing shown").toMatchObject({ state: "still", poster: true, posterShown: true, canvasShown: false })
  for (const s of log) if (s.state === "still") expect(s, "before the first frame").toMatchObject({ posterShown: true, canvasShown: false })
  expect(log.at(-1), "once drawn").toMatchObject({ state: "ready", canvas: true, canvasShown: true, posterShown: false })
}

/** Brings a block to the middle of the view (by script: a moving page never counts as stable for Playwright's own). */
async function scrollTo(page: Page, selector: string) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), selector)
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const end = document.documentElement.scrollHeight
    for (let y = 0; y < end; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
  })
}

for (const brand of BRANDS) {
  test.describe(`scenes, ${brand}`, () => {
    test("the hero's shader: the poster first, the canvas only once drawn, and a pause control", async ({ browser }) => {
      test.setTimeout(120_000)
      const { context, page, errors, three } = await desktop(browser)
      await recordWorld(context, "shader")
      await page.goto(loud(brand), { waitUntil: "load" })
      const hero = page.locator('[data-block="hero"] [data-slot="scene-layer"][data-variant="shader"]')
      await expect(hero.locator('[data-slot="world"]')).toHaveAttribute("data-state", "ready", { timeout: 30_000 })
      expectPosterFirst(await worldLog(page))
      await expect(page.locator("h1")).toHaveCount(1)
      // It moves on its own, so it has a pause control (WCAG 2.2.2). Dispatched: a software-drawn field keeps the page
      // too busy for Playwright's stability checks, never for a person's click.
      const pause = hero.locator('[data-slot="scene-pause"]')
      await expect(pause).toHaveAccessibleName("Pause motion")
      await pause.dispatchEvent("click")
      await expect(pause).toHaveAccessibleName("Play motion", { timeout: 15_000 })
      await expect(pause).toHaveAttribute("data-variant", "paused")
      // A raw WebGL scene: no Three.js.
      expect(three()).toEqual([])
      expect(errors).toEqual([])
      await context.close()
    })

    test("the case's model: Three.js only once it nears the view, the poster until the GLB is on the stage, then its controls", async ({ browser }) => {
      test.setTimeout(150_000)
      const { context, page, errors, three } = await desktop(browser)
      await recordWorld(context, "model")
      await page.goto(`${loud(brand)}&hero=poster`, { waitUntil: "networkidle" })
      const stage = page.locator('[data-slot="scene-layer"][data-variant="model"]')
      await expect(stage).toHaveAttribute("data-state", "poster")
      // The model is far down the page: Three.js is not fetched until it nears the view.
      expect(three(), "the Three.js chunk before the model nears the view").toEqual([])
      await scrollTo(page, "#tag")
      await expect(stage).toHaveAttribute("data-state", "live", { timeout: 30_000 })
      expect(three().length, "the Three.js chunk once the model nears the view").toBe(1)
      // Until the GLB is on the stage the poster stays and the canvas is hidden; then it hands over.
      await expect(stage.locator('[data-slot="world"]')).toHaveAttribute("data-state", "ready", { timeout: 60_000 })
      expectPosterFirst(await worldLog(page))
      await expect(stage.locator('[data-slot="scene-hotspot"]')).toHaveCount(3, { timeout: 30_000 })
      // The turntable moves on its own: it stops on request.
      const turn = stage.locator('[data-slot="scene-pause"]')
      await expect(turn).toHaveAccessibleName("Stop turning")
      await turn.dispatchEvent("click")
      await expect(turn).toHaveAccessibleName("Turn slowly", { timeout: 15_000 })
      await expect(stage.locator('[data-slot="scene-keys"]')).toBeVisible()
      await expect(page.getByRole("group", { name: "Finish" })).toBeVisible()
      await expect(page.getByRole("radio", { name: "Frost" })).toBeChecked()
      await page.getByRole("radio", { name: "Ember" }).dispatchEvent("click")
      await expect(page.getByRole("radio", { name: "Ember" })).toBeChecked({ timeout: 15_000 })
      await expect(page.getByRole("radio", { name: "Frost" })).not.toBeChecked()
      expect(errors).toEqual([])
      await context.close()
    })

    test("without WebGL the page is complete: posters, all its text, the parts in the hidden list, no canvas, no errors", async ({ browser }) => {
      const { context, page, errors, three } = await desktop(browser, { webgl: false })
      await page.goto(loud(brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      await page.waitForTimeout(500)
      const layers = page.locator('[data-slot="scene-layer"]')
      await expect(layers).toHaveCount(2)
      for (const layer of await layers.all()) {
        await expect(layer).toHaveAttribute("data-state", "poster")
        await expect(layer.locator('[data-slot="world"]')).toHaveAttribute("data-variant", "static")
        await expect(layer.locator('[data-slot="scene-poster"]')).toHaveCount(1)
      }
      await expect(page.locator('[data-slot="scene-layer"] canvas')).toHaveCount(0)
      await expect(page.locator('[data-slot="scene-pause"], [data-slot="scene-hotspot"], [data-slot="scene-variants"]')).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1, name: "I design interfaces that compose themselves." })).toBeVisible()
      await expect(page.getByRole("heading", { name: "The Freezon tag" })).toBeVisible()
      await expect(page.getByText("The sensor that rides with every shipment.", { exact: false })).toBeVisible()
      await expect(page.locator('[data-slot="scene-hotspot-item"]')).toHaveText(LABELS)
      await expect(page.locator('[data-slot="scene-parts"]')).toHaveClass(/sr-only/)
      await expect(page.locator('[data-slot="scene-variant-list"]')).toHaveText("Finishes: Frost, Ember.")
      expect(three()).toEqual([])
      expect(errors).toEqual([])
      await context.close()
    })

    test("under reduced motion: posters only, no canvas, no Three.js", async ({ browser }) => {
      const { context, page, errors, three } = await desktop(browser, { reducedMotion: "reduce" })
      await page.goto(loud(brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      await page.waitForTimeout(500)
      await expect(page.locator('[data-slot="scene-layer"][data-state="poster"]')).toHaveCount(2)
      await expect(page.locator('[data-slot="scene-layer"] [data-slot="world"][data-variant="static"]')).toHaveCount(2)
      await expect(page.locator('[data-slot="scene-layer"] canvas')).toHaveCount(0)
      await expect(page.locator('[data-slot="scene-poster"]')).toHaveCount(2)
      expect(three()).toEqual([])
      expect(errors).toEqual([])
      await context.close()
    })

    test("a page without a 3D scene never requests the Three.js chunk", async ({ browser }) => {
      const { context, page, three, errors } = await desktop(browser)
      await page.goto(reference(brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      await page.waitForTimeout(800)
      await expect(page.locator('[data-slot="scene-layer"]')).toHaveCount(0)
      expect(three()).toEqual([])
      expect(errors).toEqual([])
      await context.close()
    })

    test("the hotspots are named buttons the keyboard reaches, and the stage turns with the arrow keys", async ({ browser }) => {
      test.setTimeout(150_000)
      const { context, page, errors } = await desktop(browser)
      await page.goto(`${loud(brand)}&hero=poster`, { waitUntil: "networkidle" })
      await scrollTo(page, "#tag")
      const stage = page.locator('[data-slot="scene-stage"]')
      await expect(page.locator('[data-slot="scene-hotspot"]')).toHaveCount(3, { timeout: 60_000 })
      await expect(stage).toHaveAttribute("role", "group")
      await expect(stage).toHaveAccessibleName("The Freezon tag, to turn and inspect")
      await expect(stage).toHaveAttribute("aria-keyshortcuts", /ArrowLeft/)
      // Hold it still, so the buttons do not travel while the keyboard walks them.
      await page.getByRole("button", { name: "Stop turning" }).dispatchEvent("click")
      await expect(page.getByRole("button", { name: "Turn slowly" })).toBeVisible()
      await stage.focus()
      await expect(stage).toBeFocused()
      await page.keyboard.press("ArrowRight")
      await page.keyboard.press("1")
      const names: string[] = []
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Tab")
        const focused = page.locator(":focus")
        await expect(focused).toHaveAttribute("data-slot", "scene-hotspot")
        names.push((await focused.textContent()) ?? "")
        const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle)
        expect(outline, "a visible focus ring").not.toBe("none")
      }
      expect(names.sort()).toEqual([...LABELS].sort())
      for (const label of LABELS) await expect(page.getByRole("button", { name: label })).toBeVisible()
      await page.keyboard.press("Enter")
      await expect(page.locator(":focus")).toHaveAttribute("aria-pressed", "true")
      expect(errors).toEqual([])
      await context.close()
    })

    test("the loud page with its scenes still meets the mobile budgets: LCP, CLS and TBT", async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }
        w.__vitals = { lcp: 0, cls: 0, tbt: 0 }
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.cls += (e as unknown as { hadRecentInput: boolean; value: number }).hadRecentInput ? 0 : (e as unknown as { value: number }).value))).observe({ type: "layout-shift", buffered: true })
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true })
      })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: budgets.cpuThrottle })
      await page.goto(loud(brand), { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      const v = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }).__vitals)
      test.info().annotations.push({ type: "vitals (loud with scenes, mobile)", description: JSON.stringify(v) })
      expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
      expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
      expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
    })
  })
}

// `feather-page build --runtime` with the release's runtime: the page hydrates, and its model's Three.js chunk loads
// from beside the runtime (here a folder below the page), never from the page's own folder.
test("a page built with --runtime loads the release's Three.js chunk relative to the runtime", async ({ browser }) => {
  test.setTimeout(240_000)
  const repo = path.join(import.meta.dirname, "../../..")
  const release = path.join(repo, "apps/release/dist")
  if (!fs.existsSync(path.join(release, "feather-page-three.js"))) execFileSync("npx", ["vite", "build"], { cwd: path.join(repo, "apps/release"), stdio: "pipe" })
  const tmpBase = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : path.join(import.meta.dirname, "../node_modules/.cache")
  fs.mkdirSync(tmpBase, { recursive: true })
  const work = fs.mkdtempSync(path.join(tmpBase, "feather-scene-runtime-"))
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(repo, "packages/page/examples/studio-of-one-loud.page.json"), "utf8"))
    fs.copyFileSync(path.join(repo, "packages/tokens/themes/studio.json"), path.join(work, "brand.json"))
    // The hero's shader rests at its poster here, so the software-drawn field does not slow the model's check.
    doc.sections[0].scene.quality = "poster"
    fs.writeFileSync(path.join(work, "page.json"), JSON.stringify({ ...doc, brand: "brand.json" }))
    const css = fs.existsSync(path.join(release, "feather-page.css")) ? ["--css", "/built/assets/feather-page.css"] : []
    execFileSync(process.execPath, [path.join(repo, "packages/page/bin/feather-page.mjs"), "build", path.join(work, "page.json"), "--out", path.join(work, "site"), "--base", "/built/", "--runtime", "/built/assets/feather-page-runtime.js", ...css], { stdio: "pipe" })
    const { context, page, errors, three } = await desktop(browser)
    // Serve the built site, the release beside its runtime, and the page's media.
    await context.route(/\/built\//, async (route) => {
      const url = new URL(route.request().url())
      const rel = url.pathname.replace(/^\/built\//, "")
      const file = rel.startsWith("assets/") ? path.join(release, rel.slice("assets/".length)) : rel.startsWith("media/") ? path.join(import.meta.dirname, "../public", rel) : path.join(work, "site", rel || "index.html")
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" })
      const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream"
      await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { "content-type": type } })
    })
    await page.goto("/built/index.html", { waitUntil: "load" })
    // The server wrote the posters and the parts; the canvas comes only after hydration.
    await expect(page.locator('[data-slot="scene-hotspot-item"]')).toHaveText(LABELS)
    expect(three()).toEqual([])
    await scrollTo(page, "#tag")
    await expect(page.locator('[data-slot="scene-layer"][data-variant="model"] [data-slot="world"]')).toHaveAttribute("data-state", "ready", { timeout: 45_000 })
    expect(three().map((u) => new URL(u).pathname)).toEqual(["/built/assets/feather-page-three.js"])
    expect(errors).toEqual([])
    await context.close()
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
})
