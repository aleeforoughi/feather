import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { expect, test, type Browser } from "@playwright/test"

// The CLI's own static output, hydrated by the release runtime the way a caller serves it: under a subpath, with the
// release's files in a folder of their own. The server writes numbers in the page's language, and so must every
// browser, whatever its own locale: a Persian or Arabic browser writes other digits, and a mismatch makes React throw
// away the server markup (#418). After hydration the hero's title must be on screen.
const repo = path.join(import.meta.dirname, "../../..")
const release = path.join(repo, "apps/release/dist")
const SUB = "/p/demo/"
const ASSETS = `${SUB}assets/feather/`

const types: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".json": "application/json" }

let work = ""
test.beforeAll(() => {
  if (!fs.existsSync(path.join(release, "feather-page-runtime.js")) || !fs.existsSync(path.join(release, "feather-page.css"))) {
    execFileSync("pnpm", ["--filter", "@feather-apps/release", "build"], { cwd: repo, stdio: "pipe" })
  }
  const tmpBase = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : path.join(import.meta.dirname, "../node_modules/.cache")
  fs.mkdirSync(tmpBase, { recursive: true })
  work = fs.mkdtempSync(path.join(tmpBase, "feather-hydrate-"))
  const doc = JSON.parse(fs.readFileSync(path.join(repo, "packages/page/examples/studio-of-one-loud.page.json"), "utf8"))
  fs.copyFileSync(path.join(repo, "packages/tokens/themes/studio.json"), path.join(work, "brand.json"))
  fs.writeFileSync(path.join(work, "page.json"), JSON.stringify({ ...doc, brand: "brand.json" }))
  execFileSync(process.execPath, [path.join(repo, "packages/page/bin/feather-page.mjs"), "build", path.join(work, "page.json"), "--out", path.join(work, "site"), "--css", `${ASSETS}feather-page.css`, "--runtime", `${ASSETS}feather-page-runtime.js`], { stdio: "pipe" })
})
test.afterAll(() => {
  if (work) fs.rmSync(work, { recursive: true, force: true })
})

async function open(browser: Browser, locale: string, { frames = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale })
  // A view that draws no frames (a background pane, a throttled capture): requestAnimationFrame never calls back.
  if (!frames) await context.addInitScript(() => (window.requestAnimationFrame = () => 0))
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { configurable: true, get: () => 8 })
    Object.defineProperty(Navigator.prototype, "deviceMemory", { configurable: true, get: () => 8 })
  })
  await context.route(/\/p\/demo\//, async (route) => {
    const rel = new URL(route.request().url()).pathname.slice(SUB.length)
    const file = rel.startsWith("assets/feather/")
      ? path.join(release, rel.slice("assets/feather/".length))
      : rel.startsWith("media/")
        ? path.join(import.meta.dirname, "../public", rel)
        : path.join(work, "site", rel || "index.html")
    const real = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, "index.html") : file
    if (!fs.existsSync(real)) return route.fulfill({ status: 404, body: "" })
    await route.fulfill({ status: 200, body: fs.readFileSync(real), headers: { "content-type": types[path.extname(real)] ?? "application/octet-stream" } })
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  return { context, page, errors }
}

for (const locale of ["en-US", "fa-IR", "ar-EG", "de-DE"]) {
  test(`the CLI's loud page hydrates in a ${locale} browser: no errors, and the hero's title on screen`, async ({ browser }) => {
    test.setTimeout(120_000)
    const { context, page, errors } = await open(browser, locale)
    await page.goto(`${SUB}index.html`, { waitUntil: "load" })
    // Hydrated: React has taken the root, and any mismatch has been reported by now.
    await page.waitForFunction(() => {
      const root = document.querySelector("[data-feather-page-root]")
      return !!root && Object.keys(root).some((k) => k.startsWith("__reactContainer"))
    })
    await page.waitForTimeout(1500)
    expect(errors).toEqual([])
    // The digits are the page's (lang "en"), not the browser's.
    await expect(page.locator('[data-slot="counter-final"]').first()).toHaveText(/^[0-9]/)
    const h1 = page.locator("h1").first()
    await expect(h1).toBeVisible()
    await expect(h1).toContainText("I design interfaces")
    // The words paint: the topmost element at the title's centre belongs to the title, not to a layer above it.
    await expect
      .poll(() =>
        h1.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return !!hit && el.contains(hit)
        }),
      )
      .toBe(true)
    await context.close()
  })
}

// The title never depends on a frame running: in a view that draws none, its entrance shows its end state within a
// second, so a capture taken then sees every word where it rests, not held below its mask.
test("in a view that draws no frames, the hero's title shows its end state", async ({ browser }) => {
  test.setTimeout(120_000)
  const { context, page, errors } = await open(browser, "en-US", { frames: false })
  await page.goto(`${SUB}index.html`, { waitUntil: "load" })
  await page.waitForTimeout(2500)
  expect(errors).toEqual([])
  const held = await page.locator("h1").first().evaluate((h) => {
    const out: string[] = []
    for (const el of Array.from(h.querySelectorAll<HTMLElement>("[data-slot='display-title-visual'], [data-slot='display-title-piece']"))) {
      if (getComputedStyle(el).opacity === "0") out.push(`${el.dataset.piece ?? "visual"} at opacity 0`)
      for (const a of el.getAnimations()) if (a.playState !== "finished") out.push(`${el.dataset.piece} ${a.playState}`)
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform)
      if (Math.abs(m.m42) > 1) out.push(`${el.dataset.piece} moved ${m.m42}px`)
    }
    return out
  })
  expect(held).toEqual([])
  // Nothing (a loader, a scene) stands over the words.
  const h1 = page.locator("h1").first()
  expect(await h1.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!hit && el.contains(hit)
  })).toBe(true)
  await context.close()
})
