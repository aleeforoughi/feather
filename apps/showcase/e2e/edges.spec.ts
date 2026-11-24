import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { expect, test, type Page } from "@playwright/test"

// Wave 1, the page edges (feather.page/1), on the built showcase: the overlay menu, the loaders, the route transitions,
// the footer and the 404. Each one has its three tiers (no script, reduced motion, full), a keyboard path and labels.
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(async () => (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }))
  return result.violations.map((v) => `${v.id} (${v.nodes.length})`)
}

test.describe("overlay menu", () => {
  test("opens from the keyboard, traps focus, closes with Escape and gives focus back", async ({ page }) => {
    await page.goto("/sites.html?brand=studio", { waitUntil: "networkidle" })
    const toggle = page.locator('[data-slot="overlay-menu-toggle"]')
    await toggle.focus()
    await page.keyboard.press("Enter")
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.locator('[data-slot="overlay-menu-link"]').first()).toBeFocused()
    expect(await page.evaluate(() => document.querySelector("main")?.closest("[inert]") !== null)).toBe(true)
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab")
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-slot="overlay-menu"]'))).toBe(true)
    await page.keyboard.press("Escape")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(toggle).toBeFocused()
    expect(await page.evaluate(() => document.querySelector("[inert]") === null && document.documentElement.style.overflow !== "hidden")).toBe(true)
  })

  test("is a plain list of links without script", async ({ browser }) => {
    // What a no-script visitor gets is the page's static HTML (as feather-page build writes it) with the site's CSS.
    const { FeatherPage, validatePage } = await import("@aleeforoughi/feather-page")
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")
    const doc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../../packages/page/examples/studio-of-one.page.json"), "utf8"))
    const r = validatePage({ ...doc, loader: { variant: "counter" } })
    if (!r.ok) throw new Error("invalid page")
    const studio = JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve("@aleeforoughi/feather-tokens/themes/studio.json"), "utf8"))
    const assets = path.join(import.meta.dirname, "../dist/assets")
    const css = fs.readdirSync(assets).filter((f) => f.startsWith("sites-") && f.endsWith(".css")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
    const body = renderToStaticMarkup(React.createElement(FeatherPage, { page: r.page, tokens: studio.tokens }))
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.setContent(`<!doctype html><html lang="en"><head><style>${css}</style></head><body>${body}</body></html>`)
    await expect(page.locator('[data-slot="overlay-menu-link"]').first()).toBeVisible()
    await expect(page.locator('[data-slot="overlay-menu-toggle"]')).toBeHidden()
    await expect(page.locator('[data-slot="loader"]')).toBeHidden()
    await expect(page.locator("h1")).toBeVisible()
    await context.close()
  })
})

test.describe("loaders", () => {
  for (const variant of ["counter", "dock"]) {
    test(`${variant}: names itself, holds the page inert, and leaves within the cap`, async ({ page }) => {
      await page.goto(`/sites.html?brand=portrait&loader=${variant}`)
      const loader = page.locator('[data-slot="loader"]')
      await expect(loader).toHaveAttribute("role", "status")
      await expect(loader).toHaveAttribute("aria-label", /Loading/)
      await expect(loader).toHaveCount(0, { timeout: 9000 })
      expect(await page.evaluate(() => document.querySelector("[inert]") === null && document.documentElement.style.overflow !== "hidden")).toBe(true)
    })
  }

  test("never shows under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/sites.html?brand=seed&loader=counter", { waitUntil: "networkidle" })
    await expect(page.locator('[data-slot="loader"]')).toHaveCount(0)
    await expect(page.locator("h1")).toBeVisible()
  })
})

test.describe("route transitions", () => {
  for (const variant of ["view", "push", "columns", "fade", "none"]) {
    test(`${variant}: the new route arrives, focus lands on its h1, nothing is left behind`, async ({ page }) => {
      await page.goto(`/sites.html?brand=studio&transition=${variant}`, { waitUntil: "networkidle" })
      await page.locator('[data-slot="brand-switch"] a', { hasText: "seed" }).click()
      await expect(page).toHaveURL(/brand=seed/)
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.brand)).toBe("seed")
      await expect(page.locator("h1")).toBeFocused({ timeout: 4000 })
      await expect(page.locator('[data-slot="route-curtain"]')).toHaveCount(0, { timeout: 4000 })
      await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-route-transition")), { timeout: 4000 }).toBe(false)
      await expect(page.locator('[data-slot="route-announcer"]')).toHaveText(/./)
    })
  }

  test("is instant under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/sites.html?brand=studio&transition=columns", { waitUntil: "networkidle" })
    await page.locator('[data-slot="brand-switch"] a', { hasText: "portrait" }).click()
    await expect(page.locator('[data-slot="route-curtain"]')).toHaveCount(0)
    await expect(page.locator("h1")).toBeFocused()
  })
})

test.describe("footer and 404", () => {
  test("the footer's links are reachable and its wordmark is decoration", async ({ page }) => {
    await page.goto("/sites.html?brand=studio", { waitUntil: "networkidle" })
    const footer = page.locator('[data-slot="page-footer"]')
    await expect(footer).toHaveCount(1)
    await expect(footer.locator('[data-slot="page-footer-wordmark"]')).toHaveAttribute("aria-hidden", "true")
    const last = footer.locator('[data-slot="page-footer-link"]').last()
    await last.focus()
    await expect(last).toBeInViewport()
  })

  for (const brand of ["studio", "portrait", "seed"]) {
    test(`404 in ${brand}: one h1, a way home, and axe passes`, async ({ page }) => {
      await page.goto(`/sites.html?brand=${brand}&view=404`, { waitUntil: "networkidle" })
      await expect(page.locator("h1")).toHaveCount(1)
      await expect(page.locator("h1")).toHaveText("This page went somewhere else")
      await expect(page.locator('[data-slot="not-found-home"]')).toHaveAttribute("href", "/")
      expect(await axe(page)).toEqual([])
    })
  }
})
