import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

// Wave 5, product flows in a page (packages/page/examples/studio-of-one-flows.page.json): the quiz, the calculator,
// two charts, the booking flow, the podcast, the places list, the work's view switch and the colour scheme toggle. In
// every brand and both its schemes the page passes axe; the keyboard reaches a quiz result; the calculator's total is
// announced; the chart's data is a table; the podcast's controls are named and nothing plays or loads by itself; and
// a chosen scheme is on the page before its first paint, and remembered.
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "budgets.json"), "utf8"))
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const BRANDS = ["studio", "portrait", "seed"]
const url = (brand: string) => `/sites.html?page=flows&brand=${brand}`

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(async () => (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
  return result.violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)
}

/** The page's ground, as the theme sets it. */
const ground = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim())

for (const brand of BRANDS) {
  test.describe(`flows, ${brand}`, () => {
    test("renders every flow with one h1 and no errors", async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
      await page.goto(url(brand), { waitUntil: "networkidle" })
      for (const b of ["quiz", "calculator", "chart", "booking", "podcast", "places"]) await expect(page.locator(`[data-block="${b}"]`).first(), b).toBeAttached()
      await expect(page.locator('[data-block="work"][data-view]')).toBeAttached()
      await expect(page.locator("h1")).toHaveCount(1)
      expect(errors).toEqual([])
    })

    test("passes axe in both schemes (WCAG 2.2 AA)", async ({ page }) => {
      await page.goto(url(brand), { waitUntil: "networkidle" })
      const grounds: string[] = []
      for (const scheme of ["Light", "Dark"]) {
        await page.getByRole("group", { name: "Colour scheme" }).getByRole("radio", { name: scheme }).check({ force: true })
        await expect(page.locator("html")).toHaveAttribute("data-scheme", scheme.toLowerCase())
        grounds.push(await ground(page))
        expect(await axe(page), scheme).toEqual([])
        // Open every disclosure, so the transcripts and the data tables are checked too; then close them again.
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)))
        expect(await axe(page), `${scheme}, disclosures open`).toEqual([])
        await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = false)))
      }
      // The brand's own set and its other set: two grounds.
      expect(new Set(grounds).size).toBe(2)
    })
  })
}

test.describe("quiz", () => {
  test("the keyboard reaches a result, one question at a time, and can go back and start again", async ({ page }) => {
    await page.goto(url("portrait"), { waitUntil: "networkidle" })
    const quiz = page.locator('[data-block="quiz"]')
    const answer = async (name: string) => {
      // The first answer of the step takes focus by Tab; arrow keys choose within the group, as in any radio group.
      const radios = quiz.locator('[data-slot="quiz-question"][data-state="current"] input[type="radio"]')
      await radios.first().focus()
      await page.keyboard.press("Space")
      for (let i = 0; i < 3 && !(await quiz.getByRole("radio", { name, exact: true }).isChecked()); i++) await page.keyboard.press("ArrowDown")
      await expect(quiz.getByRole("radio", { name, exact: true })).toBeChecked()
    }
    const next = async () => {
      await page.keyboard.press("Tab")
      await expect(page.locator(":focus")).toHaveAttribute("data-slot", "quiz-next")
      await page.keyboard.press("Enter")
    }
    await expect(quiz.getByRole("radio")).toHaveCount(3)
    await answer("Live, with people using it")
    await next()
    await expect(page.locator(":focus")).toHaveText("Who would I work with?")
    await answer("A few designers and engineers")
    await next()
    await answer("This quarter")
    await next()
    const result = quiz.locator('[data-slot="quiz-result"]')
    await expect(result).toBeVisible()
    await expect(page.locator(":focus")).toHaveText("A design system")
    await expect(result).toContainText("3 of your 3 answers pointed here.")
    await quiz.getByRole("button", { name: "Back" }).press("Enter")
    await expect(page.locator(":focus")).toHaveText("How soon do you need something real?")
    await expect(quiz.getByRole("radio", { name: "This quarter" })).toBeChecked()
    await quiz.getByRole("button", { name: "See my result" }).press("Enter")
    await quiz.getByRole("button", { name: "Start again" }).press("Enter")
    await expect(page.locator(":focus")).toHaveText("Where is the product now?")
  })
})

test.describe("calculator", () => {
  test("announces the total and its breakdown as the person changes it", async ({ page }) => {
    await page.goto(url("seed"), { waitUntil: "networkidle" })
    const calc = page.locator('[data-block="calculator"]')
    const total = calc.getByRole("status")
    await expect(total).toHaveAttribute("aria-live", "polite")
    await expect(total).toHaveAttribute("aria-atomic", "true")
    await expect(total).toContainText("£3,250")
    const slider = calc.getByRole("slider", { name: "Pages" })
    await slider.focus()
    await page.keyboard.press("ArrowRight")
    await expect(slider).toHaveAttribute("aria-valuetext", "6 pages")
    await expect(total).toContainText("£3,900")
    await calc.getByRole("switch", { name: "Copywriting" }).check()
    await expect(total).toContainText("£4,620")
    await expect(total).toContainText("Words")
  })
})

test.describe("chart", () => {
  test("its data is a table with a caption, and its summary is the caption of the figure", async ({ page }) => {
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    const chart = page.locator('[data-block="chart"]').first()
    await expect(chart.locator("figcaption")).toContainText("about half")
    await expect(chart.locator('[data-slot="chart-frame"]')).toHaveAttribute("aria-hidden", "true")
    await chart.getByText("The data as a table").click()
    const table = chart.getByRole("table", { name: "Fewer tickets, month by month" })
    await expect(table).toBeVisible()
    await expect(table.locator("tbody tr")).toHaveCount(6)
    await expect(table.getByRole("rowheader", { name: "Jun" })).toBeVisible()
  })

  test("draws in once, and is simply there under reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" })
    const page = await context.newPage()
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    await page.locator('[data-block="chart"]').first().scrollIntoViewIfNeeded()
    const marks = page.locator('[data-slot="chart-marks"]').first()
    expect(await marks.evaluate((el) => (el as SVGGElement).style.transform)).toBe("")
    expect(await marks.evaluate((el) => el.getAnimations().length)).toBe(0)
    await context.close()
  })
})

test.describe("podcast", () => {
  test("names every control, never autoplays, loads nothing before play, and plays on request", async ({ page }) => {
    const audio: string[] = []
    page.on("request", (r) => r.url().includes("room.wav") && audio.push(r.url()))
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    const pod = page.locator('[data-block="podcast"]')
    const el = pod.locator("audio")
    await expect(el).not.toHaveAttribute("autoplay")
    await expect(el).toHaveAttribute("preload", "none")
    expect(await el.evaluate((a) => (a as HTMLAudioElement).paused)).toBe(true)
    expect(audio).toEqual([])
    for (const name of ["Play The sound of a quiet room", "Back 15 seconds", "Forward 15 seconds", "Playback speed 1 times; change"]) await expect(pod.getByRole("button", { name, exact: true })).toBeVisible()
    await expect(pod.getByRole("slider", { name: "Position" })).toHaveAttribute("aria-valuetext", /of 4 seconds/)
    await expect(pod.getByRole("button", { name: /What it taught me/ })).toBeVisible()
    await pod.getByText("Transcript", { exact: true }).click()
    await expect(pod.getByRole("switch", { name: "Follow along as it plays" })).toBeVisible()
    await pod.getByRole("button", { name: "Play The sound of a quiet room" }).click()
    await expect(pod.getByRole("button", { name: "Pause The sound of a quiet room" })).toBeVisible()
    expect(audio.length).toBeGreaterThan(0)
    await pod.getByRole("button", { name: "Pause The sound of a quiet room" }).click()
    expect(await el.evaluate((a) => (a as HTMLAudioElement).paused)).toBe(true)
  })
})

test.describe("work views", () => {
  test("switch grid, list and index with a radio group, remembered for the page", async ({ page }) => {
    await page.goto(url("portrait"), { waitUntil: "networkidle" })
    const work = page.locator('[data-block="work"]')
    await expect(work).toHaveAttribute("data-view", "grid")
    await work.getByRole("group", { name: "View" }).getByRole("radio", { name: "Index" }).check({ force: true })
    await expect(work).toHaveAttribute("data-view", "index")
    await page.reload({ waitUntil: "networkidle" })
    await expect(work).toHaveAttribute("data-view", "index")
  })
})

test.describe("colour scheme toggle", () => {
  /** Records, on the first animation frame that has the theme in it (just before that frame paints), the scheme on
   * <html> and the ground the theme gives. */
  const firstFrame = () => {
    const w = window as unknown as { __first?: { scheme: string | null; ground: string } }
    const look = () => {
      if (document.querySelector("style[data-feather-theme]")) {
        w.__first = { scheme: document.documentElement.getAttribute("data-scheme"), ground: getComputedStyle(document.documentElement).getPropertyValue("--surface-base").trim() }
      } else requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  }

  test("follows the system first, and a choice is remembered and on the page before its first paint", async ({ browser }) => {
    // The system prefers light: studio (a dark brand) opens in its light set, with no choice made.
    const context = await browser.newContext({ colorScheme: "light" })
    const page = await context.newPage()
    await page.addInitScript(firstFrame)
    await page.goto(url("studio"), { waitUntil: "networkidle" })
    const light = await ground(page)
    const group = page.getByRole("group", { name: "Colour scheme" })
    await expect(group.getByRole("radio", { name: "System" })).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-scheme"))).toBe(false)
    // Choose dark, and come back: dark from the very first frame.
    await group.getByRole("radio", { name: "Dark" }).check({ force: true })
    await expect.poll(() => ground(page)).not.toBe(light)
    const dark = await ground(page)
    await page.reload({ waitUntil: "networkidle" })
    const first = await page.evaluate(() => (window as unknown as { __first: { scheme: string | null; ground: string } }).__first)
    expect(first).toEqual({ scheme: "dark", ground: dark })
    await expect(group.getByRole("radio", { name: "Dark" })).toBeChecked()
    // System again: the choice is forgotten and the system's preference holds.
    await group.getByRole("radio", { name: "System" }).check({ force: true })
    await expect.poll(() => ground(page)).toBe(light)
    expect(await page.evaluate(() => localStorage.getItem("feather-scheme"))).toBeNull()
    await context.close()
  })

  test("in a static page, the head's script sets the choice before the body is read; with no script, the system holds", async ({ browser }) => {
    const { FeatherPage, schemeScript, validatePage } = await import("@aleeforoughi/feather-page")
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")
    const doc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../../packages/page/examples/studio-of-one-flows.page.json"), "utf8"))
    const r = validatePage(doc)
    if (!r.ok) throw new Error("invalid page")
    const studio = JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve("@aleeforoughi/feather-tokens/themes/studio.json"), "utf8"))
    const assets = path.join(import.meta.dirname, "../dist/assets")
    const css = fs.readdirSync(assets).filter((f) => f.startsWith("sites-") && f.endsWith(".css")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
    const body = renderToStaticMarkup(React.createElement(FeatherPage, { page: r.page, tokens: studio.tokens }))
    // As `feather-page build` writes it: the script first in the head. A script at the top of the body records what
    // the browser has when it starts to read the page, before any style or content of the page can paint.
    const html = `<!doctype html><html lang="en"><head><script>${schemeScript()}</script><style>${css}</style></head><body><script>window.__atBody={scheme:document.documentElement.getAttribute("data-scheme")}</script>${body}</body></html>`
    const serve = async (page: Page) => page.route("**/flows-static.html", (route) => route.fulfill({ contentType: "text/html", body: html }))
    const atBody = (page: Page) => page.evaluate(() => (window as unknown as { __atBody: { scheme: string | null } }).__atBody.scheme)

    const context = await browser.newContext({ colorScheme: "dark" })
    const page = await context.newPage()
    await serve(page)
    await page.goto("/flows-static.html")
    expect(await atBody(page)).toBeNull()
    const system = await ground(page)
    await page.evaluate(() => localStorage.setItem("feather-scheme", "light"))
    await page.reload()
    expect(await atBody(page)).toBe("light")
    const chosen = await ground(page)
    expect(chosen).not.toBe(system)
    // Both sets are in the page ahead of its content.
    expect(await page.evaluate(() => !!(document.querySelector("style[data-feather-scheme]")!.compareDocumentPosition(document.querySelector("main")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
    await context.close()

    // No script: the system's light preference gives studio's light set; the toggle is not shown.
    const off = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" })
    const still = await off.newPage()
    await serve(still)
    await still.goto("/flows-static.html")
    await expect(still.locator('[data-slot="scheme-toggle"]')).toBeHidden()
    await expect(still.locator("h1")).toBeVisible()
    const ink = await still.locator("main").evaluate((el) => getComputedStyle(el).getPropertyValue("--surface-base").trim())
    expect(ink).toBe(chosen)
    // Every flow reads with no script: all the quiz's questions, the booking form, the starting prices, the podcast.
    await expect(still.locator('[data-block="quiz"] input[type="radio"]')).toHaveCount(9)
    await expect(still.locator('[data-slot="quiz-rules"]')).toBeVisible()
    await expect(still.locator('[data-slot="calculator-prices"]')).toBeVisible()
    await expect(still.locator('[data-slot="calculator-form"]')).toBeHidden()
    await expect(still.locator('[data-block="booking"] input[name="slot"]').first()).toBeVisible()
    await expect(still.locator('[data-block="podcast"] audio')).toBeVisible()
    await off.close()
  })
})

test("flows, studio: the mobile budgets (reported, and they must pass)", async ({ page }) => {
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
  test.info().annotations.push({ type: "vitals (flows, mobile)", description: JSON.stringify(v) })
  expect(v.lcp, "LCP (ms)").toBeLessThanOrEqual(budgets.lcpMs)
  expect(v.cls, "CLS").toBeLessThanOrEqual(budgets.cls)
  expect(v.tbt, "TBT (ms)").toBeLessThan(budgets.tbtMs)
})

test.describe("tap targets at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test("every flow's links and buttons are 44 by 44 or more", async ({ page }) => {
    await page.goto(url("seed"), { waitUntil: "networkidle" })
    const small = await page.evaluate(() => {
      const out: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>('[data-block] a[href], [data-block] button, [data-slot="scheme-toggle-segment"], [data-slot="view-switch-segment"]')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue
        if (r.width < 44 || r.height < 44) out.push(`${el.getAttribute("data-slot") ?? el.tagName} "${el.textContent?.trim()}" ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
      return out
    })
    expect(small).toEqual([])
  })
})
