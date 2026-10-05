import axe from "axe-core"
import { expect, test, type Page } from "@playwright/test"

// The built docs site, served statically (playwright.config.ts). Pages are real folders: "/", "/nodes/", and so on.
const PAGES = [
  { path: "/", heading: /Calling Feather/ },
  { path: "/ir/", heading: /Experience IR/ },
  { path: "/nodes/", heading: /node reference/ },
  { path: "/lifecycle/", heading: /./ },
  { path: "/freeze/", heading: /./ },
  { path: "/composer/", heading: /./ },
  { path: "/bodies/", heading: /./ },
  { path: "/schemas/", heading: /JSON Schemas/ },
]

async function violations(page: Page) {
  await page.addScriptTag({ content: axe.source })
  return page.evaluate(async () => {
    const results = await (window as unknown as { axe: typeof axe }).axe.run(document, { resultTypes: ["violations"] })
    return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)
  })
}

for (const { path, heading } of PAGES) {
  test(`${path} loads with its landmarks and a heading`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("banner")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Docs" })).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
    expect(errors).toEqual([])
  })

  for (const scheme of ["light", "dark"] as const) {
    test(`${path} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(path)
      await expect(page.getByRole("main")).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(scheme === "dark")
      expect(await violations(page)).toEqual([])
    })
  }
}

test("every internal link resolves, anchors included", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost").origin
  const seen = new Set<string>()
  const queue = ["/"]
  const anchors = new Map<string, Set<string>>() // page path -> ids that links point at
  const ids = new Map<string, Set<string>>() // page path -> ids the page has
  while (queue.length > 0) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)
    if (path.endsWith(".json")) {
      expect((await page.request.get(path)).status(), path).toBe(200)
      continue
    }
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.getByRole("main")).toBeVisible()
    ids.set(path, new Set(await page.$$eval("[id]", (els) => els.map((e) => e.id))))
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href))
    for (const href of hrefs) {
      const url = new URL(href)
      if (url.origin !== origin) continue
      if (url.hash) (anchors.get(url.pathname) ?? anchors.set(url.pathname, new Set()).get(url.pathname)!).add(decodeURIComponent(url.hash.slice(1)))
      queue.push(url.pathname)
    }
  }
  // Every page of the site was reached, and every anchor lands on an element.
  for (const { path } of PAGES) expect([...seen], `${path} is linked`).toContain(path)
  for (const [path, wanted] of anchors) {
    for (const id of wanted) expect(ids.get(path)?.has(id), `${path}#${id}`).toBe(true)
  }
  expect([...seen].filter((p) => p.endsWith(".json")).sort()).toEqual(["/schema/feather.ir-1.json", "/schema/feather.update-1.json"])
})

test("search finds a node by name and lands on its heading", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("searchbox", { name: "Search the docs" }).fill("IrreversibleAction")
  const result = page.locator('[data-slot="docs-search-results"] a').first()
  await expect(result).toContainText("IrreversibleAction")
  await result.click()
  await expect(page).toHaveURL(/\/nodes\/#irreversibleaction$/)
  await expect(page.locator("#irreversibleaction")).toBeVisible()
})

test("search is keyboard operable", async ({ page }) => {
  await page.goto("/lifecycle/")
  await expect(page.getByRole("main")).toBeVisible()
  await page.keyboard.press("/")
  await expect(page.getByRole("searchbox", { name: "Search the docs" })).toBeFocused()
  await page.keyboard.type("schema")
  await page.keyboard.press("ArrowDown")
  await expect(page.locator('[data-slot="docs-search-results"] a').first()).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("searchbox", { name: "Search the docs" })).toBeFocused()
  await expect(page.locator('[data-slot="docs-search-results"]')).toBeHidden()
})

test("the skip link moves focus to the content", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("main")).toBeFocused()
})

test("a code block has a copy button, and the live example answers with a reply", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/")
  const block = page.locator(".code-block").first()
  await block.getByRole("button", { name: "Copy" }).click()
  await expect(block.getByRole("button")).toHaveText("Copied")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe((await block.locator("pre").textContent()) ?? "")

  const live = page.locator('[data-slot="docs-live-example"]')
  await expect(live.getByRole("heading", { name: "Try it" })).toBeVisible()
  await expect(live.locator('[data-feather-node], [data-slot="plan-view"]').first()).toBeVisible()
})

test("on a phone the nav sits behind a menu button and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/nodes/")
  await expect(page.getByRole("navigation", { name: "Docs" })).toBeHidden()
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("navigation", { name: "Docs" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await violations(page)).toEqual([])
})
