import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test, type Browser, type Page } from "@playwright/test"

// Wave 5 part A, the media reference page (packages/page/examples/studio-of-one-media.page.json, loudness 2): a
// gallery rail that loops, a before and after, a story in pinned steps, testimonials, the archive on a wheel, a
// featured journal, the toggle offer and a form. In every brand it renders with one h1 and no errors, passes axe,
// stops moving under reduced motion and meets the mobile budgets. Then each interaction's keyboard path, and the form
// and the comparison with no script.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const BRANDS = ["studio", "portrait", "seed"]
const url = (brand: string) => `/sites.html?page=media&brand=${brand}`
/** The rail's real images (an endless rail also holds hidden, inert copies of them). */
const REAL = '#studio [data-slot="reel-item"]:not([data-variant="copy"]) [data-slot="gallery-open"]'
const docPath = path.join(import.meta.dirname, "../../../packages/page/examples/studio-of-one-media.page.json")

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(async () => (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
  return result.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)
}

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

/** Brings a block to the top of the view (by script: a page with pins never counts as stable for Playwright's own). */
async function scrollTo(page: Page, selector: string) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "start" }), selector)
  await page.waitForTimeout(300)
}

/** The media page as `feather-page build` writes it (static, no script), with the site's CSS, in a context that runs
 * no script; served from a test origin so the form can post. */
async function noScript(browser: Browser, brand = "studio") {
  const { FeatherPage, validatePage } = await import("@aleeforoughi/feather-page")
  const React = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  const r = validatePage(JSON.parse(fs.readFileSync(docPath, "utf8")))
  if (!r.ok) throw new Error("invalid page")
  const tokens = JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve(`@aleeforoughi/feather-tokens/themes/${brand}.json`), "utf8")).tokens
  const assets = path.join(import.meta.dirname, "../dist/assets")
  const css = fs.readdirSync(assets).filter((f) => f.startsWith("sites-") && f.endsWith(".css")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
  const body = renderToStaticMarkup(React.createElement(FeatherPage, { page: r.page, tokens }))
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style></head><body>${body}</body></html>`
  const context = await browser.newContext({ javaScriptEnabled: false })
  const posts: { url: string; body: string; type: string }[] = []
  await context.route("https://feather.test/**", async (route) => {
    const req = route.request()
    if (req.method() === "POST") {
      posts.push({ url: req.url(), body: req.postData() ?? "", type: req.headers()["content-type"] ?? "" })
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Thanks</title><h1>Thanks</h1>" })
    }
    const file = new URL(req.url()).pathname
    if (file.startsWith("/media/")) return route.fulfill({ path: path.join(import.meta.dirname, "../public", file) })
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html })
  })
  const page = await context.newPage()
  await page.goto("https://feather.test/")
  return { context, page, posts }
}

for (const brand of BRANDS) {
  test.describe(`media, ${brand}`, () => {
    test("renders every page block with one h1 and no errors", async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
      await page.goto(url(brand), { waitUntil: "networkidle" })
      expect(await page.locator("main").getAttribute("data-loudness")).toBe("2")
      for (const block of ["gallery", "comparison", "story", "testimonials", "journal", "form"]) await expect(page.locator(`[data-block="${block}"]`).first(), block).toBeAttached()
      await expect(page.locator('[data-block-variant="toggle"]')).toBeAttached()
      await expect(page.locator("h1")).toHaveCount(1)
      await scrollThrough(page)
      // At loudness 2 with motion allowed, the archive is a wheel and the story pins.
      await expect(page.locator('#archive [data-slot="gallery"]')).toHaveAttribute("data-variant", "wheel")
      await expect(page.locator('#story [data-slot="stage"]')).toHaveAttribute("data-variant", "pinned")
      expect(errors).toEqual([])
    })

    test("passes axe (WCAG 2.2 AA), at the top, after scrolling through, and with the lightbox open", async ({ page }) => {
      await page.goto(url(brand), { waitUntil: "networkidle" })
      expect(await axe(page)).toEqual([])
      await scrollThrough(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(400)
      expect(await axe(page)).toEqual([])
      await scrollTo(page, "#studio")
      await page.locator(REAL).first().click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.waitForTimeout(400)
      expect(await axe(page)).toEqual([])
    })

    test("stops moving under reduced motion: the wheel is the rail, the story stacks", async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce" })
      const page = await context.newPage()
      await page.goto(url(brand), { waitUntil: "networkidle" })
      await scrollThrough(page)
      await expect(page.locator('#archive [data-slot="gallery"]')).toHaveAttribute("data-variant", "rail")
      await expect(page.locator('#story [data-slot="stage"]')).toHaveAttribute("data-variant", "static")
      expect(await page.locator('#story [data-slot="stage-step"] img').count()).toBe(3)
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

    test("meets the mobile budgets: LCP, CLS and TBT", async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }
        w.__vitals = { lcp: 0, cls: 0, tbt: 0 }
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true })
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.cls += (e as unknown as { hadRecentInput: boolean; value: number }).hadRecentInput ? 0 : (e as unknown as { value: number }).value))).observe({ type: "layout-shift", buffered: true })
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__vitals.tbt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true })
      })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: budgets.cpuThrottle })
      await page.goto(url(brand), { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      const v = await page.evaluate(() => (window as unknown as { __vitals: { lcp: number; cls: number; tbt: number } }).__vitals)
      test.info().annotations.push({ type: "vitals (media, mobile)", description: JSON.stringify(v) })
      expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
      expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
      expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
    })
  })
}

test.describe("gallery", () => {
  test("keyboard: Enter opens the lightbox at the image, the arrows step, Escape closes and gives focus back", async ({ page }) => {
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    await scrollTo(page, "#studio")
    const links = page.locator(REAL)
    // The endless rail's copies are hidden and never focusable: only the six real images are links.
    await expect(page.locator('#studio [data-slot="reel-item"][data-variant="copy"]').first()).toHaveAttribute("inert", "")
    expect(await page.locator("#studio").getByRole("link").count()).toBe(6)
    await links.nth(1).focus()
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading")).toHaveText("A Freezon shipment card with its one warning")
    await expect(dialog).toContainText("2 of 6")
    await expect(dialog.getByRole("link", { name: /Download/ })).toHaveCount(0)
    await page.keyboard.press("ArrowRight")
    await expect(dialog.getByRole("heading")).toHaveText("The Evercover quote, one sentence long")
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowLeft")
    await expect(dialog.getByRole("heading")).toHaveText("The Acceptto sign-in on a phone, resting on linen")
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(links.nth(1)).toBeFocused()
  })

  test("the rail scrolls by its buttons and the keyboard, and Tab leaves it", async ({ page }) => {
    await page.goto(url("portrait"), { waitUntil: "networkidle" })
    await scrollTo(page, "#studio")
    const track = page.locator('#studio [data-slot="reel-track"]')
    const start = await track.evaluate((el) => el.scrollLeft)
    await page.locator('#studio [data-slot="reel-next"]').click()
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(start)
    // Tab from the last real image goes on to the rail's buttons, out of the copies.
    await page.locator(REAL).last().focus()
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-slot"))).toBe("reel-previous")
  })

  test("the wheel turns one step per arrow key, announces the front image and opens it", async ({ page }) => {
    await page.goto(url("seed"), { waitUntil: "networkidle" })
    await scrollTo(page, "#archive")
    const stage = page.locator('#archive [data-slot="gallery-wheel-stage"]')
    const status = page.locator('#archive [data-slot="gallery-wheel-status"]')
    await stage.focus()
    await expect(status).toHaveText("1 of 6: Acceptto")
    await page.keyboard.press("ArrowRight")
    await expect(status).toHaveText("2 of 6: Freezon")
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowLeft")
    await expect(status).toHaveText("6 of 6: Field kit")
    // Only the front image is reachable: Tab goes from the ring to it, then on to the buttons.
    await page.keyboard.press("Tab")
    await expect(page.locator('#archive [data-slot="gallery-item"][data-state="active"] [data-slot="gallery-open"]')).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText("The notebook, open on its grid page")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.locator('#archive [data-slot="gallery-item"][data-state="active"] [data-slot="gallery-open"]')).toBeFocused()
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-slot"))).toBe("gallery-wheel-previous")
  })
})

test.describe("comparison", () => {
  test("a named native range: the arrow keys, Home and End move the divider and speak both shares", async ({ page }) => {
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    await scrollTo(page, "#compare")
    const range = page.getByRole("slider", { name: /Before and After/ })
    await expect(range).toHaveAttribute("aria-valuetext", "Before 50%, After 50%")
    await range.focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight")
    await expect(range).toHaveAttribute("aria-valuetext", "Before 55%, After 45%")
    const frame = page.locator('#compare [data-slot="comparison"]')
    expect(await frame.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--split"))).toBe("55%")
    expect(await page.locator('#compare [data-slot="comparison-after"]').evaluate((el) => getComputedStyle(el).clipPath)).toContain("55%")
    await page.keyboard.press("Home")
    await expect(range).toHaveAttribute("aria-valuetext", "Before 0%, After 100%")
    await page.keyboard.press("End")
    await expect(range).toHaveAttribute("aria-valuetext", "Before 100%, After 0%")
    // Both pictures are always there, with their alt text.
    await expect(page.locator("#compare img")).toHaveCount(2)
    await expect(page.getByAltText("The old sign-in: four fields and a password rule")).toBeAttached()
    await expect(page.getByAltText("The new sign-in: one field and a passkey")).toBeAttached()
  })

  test("drags with the pointer", async ({ page }) => {
    await page.goto(url("portrait"), { waitUntil: "networkidle" })
    await scrollTo(page, "#compare")
    const box = (await page.locator('#compare [data-slot="comparison"]').boundingBox())!
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2)
    const value = Number(await page.getByRole("slider").inputValue())
    expect(value).toBeGreaterThan(15)
    expect(value).toBeLessThan(35)
  })

  test("with no script, the two pictures stand side by side and the range is not there", async ({ browser }) => {
    const { context, page } = await noScript(browser)
    const frame = page.locator('#compare [data-slot="comparison"]')
    expect(await frame.evaluate((el) => getComputedStyle(el).display)).toBe("grid")
    await expect(page.locator('#compare [data-slot="comparison-range"]')).toBeHidden()
    const [a, b] = await Promise.all(["before", "after"].map((k) => page.locator(`#compare [data-slot="comparison-${k}"]`).boundingBox()))
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1)
    await context.close()
  })
})

test.describe("form", () => {
  test("works with no script: the whole form, native controls, and it posts its answers", async ({ browser }) => {
    const { context, page, posts } = await noScript(browser, "portrait")
    const form = page.locator("#enquiry form")
    await expect(form).toHaveAttribute("method", "post")
    await page.getByLabel("Your name").fill("Ada Lovelace")
    await page.getByLabel("Email").fill("ada@example.com")
    await page.getByLabel("Budget").selectOption("€10k to €30k")
    // By the keyboard: a page with script turned off gives Playwright no animation frames to judge a click by.
    await page.getByRole("radio", { name: "Next quarter" }).focus()
    await page.keyboard.press("Space")
    await expect(page.getByRole("radio", { name: "Next quarter" })).toBeChecked()
    await page.getByLabel(/What are you making/).fill("An engine that composes music.")
    await page.locator('#enquiry [data-slot="form-submit"]').focus()
    await page.keyboard.press("Enter")
    await expect.poll(() => posts.length).toBe(1)
    expect(posts[0].url).toBe("https://feather.test/contact")
    const sent = new URLSearchParams(posts[0].body)
    expect(Object.fromEntries(sent)).toEqual({ name: "Ada Lovelace", email: "ada@example.com", budget: "€10k to €30k", start: "Next quarter", message: "An engine that composes music." })
    await context.close()
  })

  test("with no script, the browser's own checks hold: nothing posts until the required answers are there", async ({ browser }) => {
    const { context, page, posts } = await noScript(browser, "seed")
    await page.locator('#enquiry [data-slot="form-submit"]').focus()
    await page.keyboard.press("Enter")
    await page.waitForTimeout(300)
    expect(posts).toHaveLength(0)
    expect(await page.getByLabel("Your name").evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true)
    await context.close()
  })

  test("with script: messages in words beside each field, a summary, focus on the first; then it posts", async ({ page }) => {
    const posts: string[] = []
    await page.route("**/contact", (route) => {
      posts.push(route.request().postData() ?? "")
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Thanks</title><main><h1>Thanks</h1></main>" })
    })
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    await scrollTo(page, "#enquiry")
    await page.locator('#enquiry [data-slot="form-submit"]').click()
    const alerts = page.locator('#enquiry [role="alert"]')
    await expect(alerts).toHaveText(["Fill in your name.", "Fill in email.", "Choose budget.", "Fill in what are you making."])
    await expect(page.locator('#enquiry [data-slot="form-status"]')).toHaveText("4 answers need a look: Your name, Email, Budget, What are you making.")
    await expect(page.getByLabel("Your name")).toBeFocused()
    await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true")
    await page.getByLabel("Your name").fill("Ada")
    await page.getByLabel("Email").fill("ada@example.com")
    // The select is feather-react's once the script runs: open it and choose.
    await page.locator("#enquiry-budget").click()
    await page.getByRole("option", { name: "Over €30k" }).click()
    await page.getByRole("radio", { name: "This month" }).click()
    await page.getByLabel(/What are you making/).fill("A calmer bank.")
    await page.locator('#enquiry [data-slot="form-submit"]').click()
    await expect.poll(() => posts.length).toBe(1)
    expect(Object.fromEntries(new URLSearchParams(posts[0]))).toMatchObject({ name: "Ada", email: "ada@example.com", budget: "Over €30k", start: "This month", message: "A calmer bank." })
  })
})
