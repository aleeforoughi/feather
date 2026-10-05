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

// L6: an experience over time (docs/lifecycle.md). The playground is the caller; the Stream view plays
// conformance/update/valid/streamed-trip.json.
const SUMMARY = "Booked: direct flight, 9:40, 1,240 AED."
const APPROVE = '{"experience":"plan_trip","node":"ok","act":"approve"}'

async function streamView(page: Page) {
  await page.getByRole("tab", { name: "Stream" }).click()
  await expect(page.getByTestId("stream-revision")).toHaveAttribute("data-revision", "0")
  return page.getByTestId("stream-rendered")
}
const next = (page: Page) => page.getByTestId("stream-next").click()
const revision = (page: Page, n: number) => expect(page.getByTestId("stream-revision")).toHaveAttribute("data-revision", String(n))

test("L6 exit: a streamed experience runs end to end and leaves only the artifact and a one-line summary", async ({ page }) => {
  const view = await streamView(page)
  await expect(view).toContainText("Finding flights")
  await expect(page.getByTestId("stream-last-update")).toHaveText("none yet")

  await next(page)
  await revision(page, 1)
  await expect(view.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50")
  await expect(page.getByTestId("stream-last-update")).toContainText('"revision": 1')

  await next(page)
  await revision(page, 2)
  await expect(view).toContainText("Direct, 9:40, 1,240 AED")
  await expect(view.getByRole("button", { name: /^Approve/ })).toBeVisible()

  // The person approves in the body; the reply reaches the log. The caller then goes on.
  await view.getByRole("button", { name: /^Approve/ }).click()
  // Spending money is armed first and committed by a second, deliberate act: nothing is sent yet.
  await expect(page.getByTestId("last-reply")).toHaveText("none yet")
  await view.getByRole("button", { name: /^Yes/ }).click()
  await expect(page.getByTestId("last-reply")).toHaveText(APPROVE)
  await expect(page.getByTestId("last-reply")).toHaveAttribute("data-body", "web")

  await next(page)
  await revision(page, 3)
  await expect(view.locator('[data-slot="experience-resolution-summary"]')).toHaveText(SUMMARY)
  await expect(view.getByRole("link", { name: "Booking confirmation" })).toHaveAttribute("href", "https://example.com/booking/42")
  await expect(view.getByRole("button")).toHaveCount(0)
  await expect(view.getByRole("progressbar")).toHaveCount(0)
  await expect(page.getByTestId("stream-next")).toBeDisabled()
  await expect(page.getByTestId("last-reply")).toHaveText(APPROVE) // still the one reply

  // Restart begins again from the first experience.
  await page.getByTestId("stream-restart").click()
  await revision(page, 0)
  await expect(view).toContainText("Finding flights")
})

test("the stream can go on without approving: the caller decides", async ({ page }) => {
  const view = await streamView(page)
  await next(page)
  await next(page)
  await expect(view.getByRole("button", { name: /^Approve/ })).toBeVisible()
  await next(page)
  await expect(view).toContainText(SUMMARY)
  await expect(page.getByTestId("last-reply")).toHaveText("none yet")
})

test("a stale update from the paste box is refused with its issues, and nothing changes", async ({ page }) => {
  const view = await streamView(page)
  await next(page)
  await revision(page, 1)
  // The editor starts with the revision 1 update, which is now stale.
  await page.getByTestId("stream-apply").click()
  await expect(page.getByTestId("stream-issues")).toContainText("stale-revision")
  await revision(page, 1)
  await expect(view.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50")

  // A broken paste says so, and a good one (the next revision) is applied.
  await page.getByTestId("stream-editor").fill("{ nope")
  await page.getByTestId("stream-apply").click()
  await expect(page.getByTestId("stream-paste-problem")).toContainText("not valid JSON")
  await page.getByTestId("stream-editor").fill(JSON.stringify({ update: "feather.update/0", experience: "plan_trip", revision: 2, ops: [{ op: "resolve", outcome: "cancelled", summary: "Stopped." }] }))
  await page.getByTestId("stream-apply").click()
  await revision(page, 2)
  await expect(page.getByTestId("stream-issues")).toHaveCount(0)
  await expect(view).toContainText("Stopped.")
})

test("auto-play never starts by itself, and waits at the approval", async ({ page }) => {
  await streamView(page)
  await page.waitForTimeout(2600)
  await revision(page, 0)
  await page.getByTestId("stream-play").click()
  await expect(page.getByTestId("stream-play")).toHaveText("Pause")
  await revision(page, 2)
  await expect(page.getByTestId("stream-play")).toHaveText("Play")
  await page.waitForTimeout(2600)
  await revision(page, 2)
})

test("with reduced motion there is no auto-play", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await streamView(page)
  await expect(page.getByTestId("stream-play")).toHaveCount(0)
  await next(page)
  await revision(page, 1)
})

test("voice body: the same stream is spoken to the same summary", async ({ page }) => {
  await streamView(page)
  await choose(page, "Body", "voice")
  const log = page.getByTestId("stream-rendered").getByRole("log", { name: "Transcript" })
  await next(page)
  await next(page)
  await next(page)
  await revision(page, 3)
  await expect(log).toContainText(SUMMARY)
})

test("text body: the same stream reaches the same summary", async ({ page }) => {
  await streamView(page)
  await choose(page, "Body", "text")
  const log = page.getByTestId("stream-rendered").getByRole("log", { name: "Conversation" })
  await expect(log).toContainText("Finding flights")
  await next(page)
  await next(page)
  await expect(log).toContainText("approve the booking")
  await next(page)
  await revision(page, 3)
  await expect(log).toContainText(SUMMARY)
  await expect(log).toContainText("Booking confirmation: https://example.com/booking/42")
})
