import { expect, test, type Page } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await choose(page, "Fixture", "ad-campaign-launch")
})

/** Picks a value in one of the playground's Feather Selects, as a person would: open it, then choose the option. */
async function choose(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.locator(`[role="option"][data-value="${value}"]`).click()
  await expect(page.getByRole("listbox")).toBeHidden()
}

const SPEND = '{"experience":"approve_campaign","node":"go","act":"confirm"}'
const body = (page: Page, name: string) => page.locator(`[data-testid="context-panel"][data-body="${name}"]`)

async function fourContexts(page: Page) {
  await page.getByRole("tab", { name: "Four contexts" }).click()
}

test("the ad campaign fixture shows four titled contexts, each in its own body", async ({ page }) => {
  await fourContexts(page)
  await expect(page.getByTestId("context-title")).toHaveText(["Phone, defaults", "Switch access: two switches", "No screen: voice only", "Terminal"])
  await expect(page.getByTestId("context-body")).toHaveText(["(web)", "(switch)", "(voice)", "(text)"])
  await expect(body(page, "web").locator('[data-slot="plan-view"], [data-feather-node]').first()).toBeVisible()
  await expect(body(page, "switch").getByTestId("switch-hint")).toHaveText("Tab: next · Enter: select")
  await expect(body(page, "switch").locator('[data-slot="switch-scanner"]')).toBeVisible()
  // Voice shows what Feather says, with the consequence, and text shows the turn.
  await expect(body(page, "voice").getByRole("log", { name: "Transcript" })).toContainText("Feather says: Spends AED 1,050")
  await expect(body(page, "text").getByRole("log", { name: "Conversation" })).toContainText("Spends AED 1,050")
})

test("text: the number arms the spend, only the keyword commits", async ({ page }) => {
  await fourContexts(page)
  const text = body(page, "text")
  const input = text.getByLabel("Type a reply")
  const log = text.getByRole("log")
  const reply = page.getByTestId("last-reply")
  await input.fill("1")
  await input.press("Enter")
  await expect(log).toContainText('Type "confirm" to go ahead')
  await expect(reply).toHaveText("none yet")
  for (const wrong of ["1", "yes"]) {
    await input.fill(wrong)
    await input.press("Enter")
    await expect(log).toContainText("Nothing was done.")
    await expect(reply).toHaveText("none yet")
  }
  await input.fill("confirm")
  await input.press("Enter")
  await expect(reply).toHaveText(SPEND)
  await expect(reply).toHaveAttribute("data-body", "text")
  await expect(page.getByTestId("last-reply-body")).toContainText("text")
  await expect(log).toContainText("reply sent: " + SPEND)
})

test("voice: 'option one' arms the spend, only the keyword commits", async ({ page }) => {
  await fourContexts(page)
  const voice = body(page, "voice")
  const input = voice.getByLabel("Say (as transcribed)")
  const log = voice.getByRole("log")
  const reply = page.getByTestId("last-reply")
  await input.fill("option one")
  await input.press("Enter")
  await expect(log).toContainText("You said: option one")
  await expect(log.getByText("Feather says:").last()).toBeVisible()
  await expect(log).toContainText("confirm")
  await expect(reply).toHaveText("none yet")
  await input.fill("yes")
  await input.press("Enter")
  await expect(reply).toHaveText("none yet")
  await input.fill("confirm")
  await input.press("Enter")
  await expect(reply).toHaveText(SPEND)
  await expect(reply).toHaveAttribute("data-body", "voice")
})

test("voice: nothing is spoken on load or while the toggle is off", async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { spoken: string[] }).spoken = []
    const synth = window.speechSynthesis
    if (synth) synth.speak = (u) => void (window as unknown as { spoken: string[] }).spoken.push(u.text)
  })
  await page.reload()
  await choose(page, "Fixture", "ad-campaign-launch")
  await fourContexts(page)
  const voice = body(page, "voice")
  await expect(voice.getByRole("checkbox", { name: "Speak aloud" })).toHaveAttribute("aria-checked", "false")
  await voice.getByLabel("Say (as transcribed)").fill("help")
  await voice.getByLabel("Say (as transcribed)").press("Enter")
  await expect(voice.getByRole("log")).toContainText("You said: help")
  expect(await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual([])
})

test("switch: Tab and Enter arm the spend, then confirm it", async ({ page }) => {
  await fourContexts(page)
  const scanner = body(page, "switch").locator('[data-slot="switch-scanner"]')
  const armer = scanner.getByRole("button", { name: /^Confirm spend…/ })
  // Native Tab reaches the panel; inside it Tab is the scanner's "next".
  await page.getByTestId("switch-hint").locator("..").focus()
  await page.keyboard.press("Tab")
  for (let i = 0; i < 12 && !(await armer.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab")
  await expect(armer).toBeFocused()
  await expect(armer).toHaveAttribute("data-scanned", "true")
  await page.keyboard.press("Enter")
  const yes = scanner.getByRole("button", { name: "Yes, confirm spend" })
  await expect(yes).toBeFocused()
  await expect(page.getByTestId("last-reply")).toHaveText("none yet")
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("last-reply")).toHaveText(SPEND)
  await expect(page.getByTestId("last-reply")).toHaveAttribute("data-body", "switch")
})

test("the rest of the page stays usable by keyboard beside the switch panel", async ({ page }) => {
  await fourContexts(page)
  // Enter on a control outside the panel still does its own thing (the scanner does not swallow it).
  await page.getByRole("tab", { name: "Plan" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("plan-json")).toBeVisible()
})

test("the Rendered tab renders any context through its own body", async ({ page }) => {
  await expect(page.getByTestId("rendered-body")).toContainText("web")
  for (const [context, name] of [["terminal", "text"], ["screenless", "voice"], ["switch", "switch"], ["desktop", "web"], ["low-vision", "web"]] as const) {
    await choose(page, "Context", context)
    await expect(page.getByTestId("rendered-body")).toContainText(name)
  }
  await choose(page, "Context", "terminal")
  await page.getByLabel("Type a reply").fill("1")
  await page.getByLabel("Type a reply").press("Enter")
  await expect(page.getByRole("log")).toContainText('Type "confirm"')
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

test("by person: the deliberate persona preselects nothing; no-screen-speaking routes to voice", async ({ page }) => {
  await choose(page, "Fixture", "predicted-news-topic")
  await page.getByRole("tab", { name: "By person" }).click()
  const view = page.getByTestId("person-view")
  await choose(page, "Persona", "deliberate")
  await expect(view.getByTestId("person-changes")).toContainText("nothing is preselected")
  await expect(view.getByTestId("person-body")).toContainText("web")
  await expect(view.locator('[data-slot="experience-prediction-note"]')).toBeVisible()
  const radios = view.getByRole("radio")
  expect(await radios.count()).toBeGreaterThan(0)
  for (const radio of await radios.all()) await expect(radio).not.toBeChecked()
  // Only the person-shaped rules are in the trace, and the deciding one is among them.
  await expect(view.locator('tr[data-rule="autonomy"]').first()).toHaveAttribute("data-highlighted", "true")
  await expect(view.locator("tr[data-rule]:not([data-highlighted])")).toHaveCount(0)
  await choose(page, "Persona", "none")
  await choose(page, "Capability profile", "no-screen-speaking")
  await expect(view.getByTestId("person-body")).toContainText("voice")
  await expect(view.getByRole("log", { name: "Transcript" })).toBeVisible()
  await expect(view.locator('tr[data-rule="output-routing"]').first()).toBeVisible()
})

test("by person: nothing about the chosen person is stored or put in the URL", async ({ page }) => {
  await page.getByRole("tab", { name: "By person" }).click()
  await choose(page, "Persona", "deliberate")
  await choose(page, "Capability profile", "low-vision")
  await expect(page.getByTestId("person-changes")).toContainText("AAA")
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie)
  expect(stored).not.toMatch(/deliberate|low-vision|persona|capab/i)
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe("")
})
