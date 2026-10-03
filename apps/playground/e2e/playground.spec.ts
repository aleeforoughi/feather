import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Fixture").selectOption("ad-campaign-launch")
})

test("the ad campaign fixture shows four titled contexts", async ({ page }) => {
  await page.getByRole("tab", { name: "Four contexts" }).click()
  const titles = page.getByTestId("context-title")
  await expect(titles).toHaveCount(4)
  await expect(titles).toHaveText(["Phone, defaults", "Desktop, wants the reasoning", "Low vision, low motor precision, reduced motion", "No screen: voice only"])
  // The voice context shows the summary, with the consequence.
  const voice = page.getByTestId("context-panel").nth(3)
  await expect(voice.locator('[data-slot="experience-summary"]')).toContainText("Spends AED 1,050")
})

test("composing takes under 5 ms", async ({ page }) => {
  const time = page.getByTestId("compose-time")
  const ms = Number(await time.getAttribute("data-compose-ms"))
  expect(ms).toBeGreaterThan(0)
  expect(ms).toBeLessThan(5)
})

test("breaking the JSON shows issues, and fixing it clears them", async ({ page }) => {
  const editor = page.getByLabel("Experience IR (JSON)")
  const good = await editor.inputValue()
  await editor.fill('{ "ir": ')
  await expect(page.getByTestId("issues")).toContainText("not valid JSON")
  await editor.fill(good.replace('"intent": "spend less"', '"intent": "spend less", "color": "red"'))
  await expect(page.getByTestId("issues")).toContainText("presentational-field")
  await editor.fill(good)
  await expect(page.getByTestId("issues")).toHaveCount(0)
})

test("confirming the spend by keyboard shows the reply", async ({ page }) => {
  await page.getByRole("button", { name: /^Confirm spend…/ }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: "Yes, confirm spend" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("last-reply")).toHaveText('{"experience":"approve_campaign","node":"go","act":"confirm"}')
})
