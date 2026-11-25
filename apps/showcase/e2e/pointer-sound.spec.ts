import { expect, test } from "@playwright/test"

// Wave 3's exit test on the loud page: sound is off until the person turns it on, the one mute is always reachable
// from the keyboard and remembered; the pointer follower labels work links and never hides the native cursor.

test.describe("sound", () => {
  test("is off by default, the toggle is in the nav, reachable by keyboard, and the choice is remembered", async ({ page }) => {
    await page.goto("/sites.html?page=loud&brand=studio", { waitUntil: "networkidle" })
    const toggle = page.locator('[data-slot="overlay-menu"] [data-slot="sound-toggle"]')
    await expect(toggle).toHaveCount(1)
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    const box = await toggle.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    // From the top of the page, the toggle is reached by Tab alone.
    let reached = false
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab")
      reached = await toggle.evaluate((el) => el === document.activeElement)
    }
    expect(reached).toBe(true)
    await page.keyboard.press("Enter")
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await page.reload({ waitUntil: "networkidle" })
    await expect(page.locator('[data-slot="overlay-menu"] [data-slot="sound-toggle"]')).toHaveAttribute("aria-pressed", "true")
    await page.locator('[data-slot="overlay-menu"] [data-slot="sound-toggle"]').click()
    await expect(page.locator('[data-slot="overlay-menu"] [data-slot="sound-toggle"]')).toHaveAttribute("aria-pressed", "false")
  })

  test("a page without a bed shows no toggle", async ({ page }) => {
    await page.goto("/sites.html?brand=studio", { waitUntil: "networkidle" })
    await expect(page.locator('[data-slot="sound-toggle"]')).toHaveCount(0)
  })
})

test.describe("pointer", () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 800 } })

  test("the follower labels work links on a fine pointer and keeps the native cursor", async ({ page }) => {
    await page.goto("/sites.html?page=loud&brand=studio", { waitUntil: "networkidle" })
    await expect(page.locator('[data-cursor="view"]').first()).toBeAttached()
    expect(await page.evaluate(() => [...document.querySelectorAll("*")].some((el) => getComputedStyle(el).cursor === "none"))).toBe(false)
  })

  test("there is no follower under reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    await page.goto("/sites.html?page=loud&brand=studio", { waitUntil: "networkidle" })
    await expect(page.locator('[data-slot="cursor"]')).toHaveCount(0)
    await context.close()
  })
})
