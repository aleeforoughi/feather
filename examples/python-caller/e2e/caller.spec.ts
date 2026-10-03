import { expect, test } from "@playwright/test"

// A Python caller sends an experience, Feather renders it in a plain page, and the person's decision comes back to
// the server, which validates it before accepting it (docs/callers.md).

test("the experience renders inside the caller's page, and leaves the page's own styles alone", async ({ page }) => {
  await page.goto("/")
  const root = page.locator(".feather-root").first()
  await expect(root.getByText("Recommended test: 7 days, purchase objective")).toBeVisible()
  // The caller's heading keeps the caller's font; Feather's text is in Feather's.
  const font = (element: ReturnType<typeof page.locator>) => element.evaluate((e) => getComputedStyle(e).fontFamily)
  expect(await font(page.locator("h1"))).toContain("system-ui")
  expect(await font(root.getByRole("button", { name: /^Confirm spend…/ }))).toContain("JetBrains Mono")
})

test("confirming the spend sends one validated reply to the server", async ({ page, request }) => {
  await page.goto("/")
  // An irreversible act takes a deliberate second step: arm it, then confirm it.
  await page.getByRole("button", { name: /^Confirm spend…/ }).click()
  await page.getByRole("button", { name: "Yes, confirm spend" }).click()
  await expect(page.getByTestId("status")).toHaveText("Server accepted: go confirm")
  const decisions = await (await request.get("/api/decisions")).json()
  expect(decisions.at(-1)).toEqual({ experience: "approve_campaign", node: "go", act: "confirm" })
})

test("the server rejects a reply the experience cannot produce", async ({ request }) => {
  const response = await request.post("/api/reply", { data: { experience: "approve_campaign", node: "go", act: "launch" } })
  expect(response.status()).toBe(422)
  const forged = await request.post("/api/reply", { data: { experience: "approve_campaign", node: "nope", act: "confirm" } })
  expect(forged.status()).toBe(422)
})
