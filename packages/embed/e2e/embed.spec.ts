// The embed in a copy of Godpip's page (e2e/host): a plain HTML page with its own stylesheet, whose custom property names
// collide with Feather's and whose element rules style every button, heading and paragraph. Feather must render well in
// it and leave it exactly as it was.
import fs from "node:fs"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/ir/valid", `${name}.json`), "utf8")).ir
const AD = fixture("ad-campaign-launch")
const NEWS = fixture("news-article")
const SPEND = { experience: "approve_campaign", node: "go", act: "confirm" }

declare global {
  interface Window {
    __featherReady?: boolean
    __feather: {
      embed: { version: string; validate: (x: unknown) => { ok: boolean }; validateReply: (e: unknown, x: unknown) => { ok: boolean } }
      views: Record<string, { update(e: unknown, c?: unknown): void; unmount(): void; ready: Promise<void>; root: HTMLElement }>
      replies: Array<{ slot: string; reply: unknown }>
      issues: Array<{ slot: string; issues: Array<{ code: string }> }>
      mount(slot: string, experience: unknown, options?: Record<string, unknown>): { ready: Promise<void> }
    }
    __hostEls?: Element[]
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => window.__featherReady)
})

/** Mounts through the page's own code and waits until the first render is in. */
async function mount(page: Page, slot: string, experience: unknown, options: Record<string, unknown> = {}) {
  await page.evaluate(async ([slot, experience, options]) => {
    const view = window.__feather.mount(slot as string, experience, options as Record<string, unknown>)
    await view.ready
  }, [slot, experience, options] as const)
  await page.locator(`#${slot} [data-feather]`).waitFor({ state: "attached" })
}

// What the host page's elements look like, for every element that was in the page before Feather.
const PROPS = ["color", "background-color", "font-family", "font-size", "margin", "padding", "border", "border-radius", "line-height", "border-top-color", "box-sizing", "display", "font-weight", "text-transform", "letter-spacing"]

async function remember(page: Page) {
  await page.evaluate(() => {
    window.__hostEls = [...document.querySelectorAll("*")]
  })
}

interface HostState {
  styles: string[]
  vars: Record<string, string>
  customProperties: string[]
  registered: string[]
  htmlAttrs: string
  bodyAttrs: string
}

async function hostState(page: Page): Promise<HostState> {
  return page.evaluate((props) => {
    const els = window.__hostEls!
    const styles = els.map((el) => {
      const cs = getComputedStyle(el)
      return `${el.tagName.toLowerCase()}#${el.id}.${el.className && typeof el.className === "string" ? el.className : ""} ${props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";")}`
    })
    // Every custom property the host's own stylesheet puts on :root, as the document computes it.
    const names = new Set<string>()
    for (const sheet of document.styleSheets) {
      if (!sheet.href?.endsWith("/styles.css")) continue
      for (const rule of sheet.cssRules) if (rule instanceof CSSStyleRule && rule.selectorText === ":root") for (const p of rule.style) if (p.startsWith("--")) names.add(p)
    }
    const rootStyle = getComputedStyle(document.documentElement)
    const vars: Record<string, string> = {}
    for (const n of names) vars[n] = rootStyle.getPropertyValue(n)
    const attrs = (el: Element) => [...el.attributes].map((a) => `${a.name}=${a.value}`).join(" ")
    return {
      styles,
      vars,
      customProperties: [...rootStyle].filter((p) => p.startsWith("--")).sort(),
      // `@property` registrations: a registered property shows its initial value on every element, which is not a declaration.
      registered: [...document.styleSheets].flatMap((sheet) => (sheet.href?.endsWith("/feather-embed.css") ? [...sheet.cssRules] : [])).filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule).map((r) => r.name),
      htmlAttrs: attrs(document.documentElement),
      bodyAttrs: attrs(document.body),
    }
  }, PROPS)
}

function expectHostUntouched(before: HostState, after: HostState, { whileModalOpen = false } = {}) {
  expect(after.styles).toEqual(before.styles)
  expect(after.vars).toEqual(before.vars)
  expect(Object.keys(before.vars).length).toBeGreaterThan(10)
  // Not one custom property was declared on <html>: Feather's live on its own roots.
  expect(after.customProperties.filter((p) => !before.customProperties.includes(p) && !after.registered.includes(p))).toEqual([])
  // While a modal popup is open, Base UI locks the page's scroll with an inline `overflow`; it is gone again on close.
  const attrs = (a: string) => (whileModalOpen ? a.replace(/\s?style=[^;]*;?/, "") : a)
  expect(attrs(after.htmlAttrs)).toBe(attrs(before.htmlAttrs))
  expect(attrs(after.bodyAttrs)).toBe(attrs(before.bodyAttrs))
}

const computed = (page: Page, selector: string, props: string[]) =>
  page.locator(selector).first().evaluate((el, props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])), props)

test("a: the host page's elements and custom properties are identical before, after mount and after a popup opens", async ({ page }) => {
  await remember(page)
  const before = await hostState(page)
  expect(before.vars["--border"]).toBe("#2b332e") // the host's own --border: the name Feather also uses

  await mount(page, "slot-a", AD)
  expectHostUntouched(before, await hostState(page))

  await mount(page, "slot-b", NEWS)
  await page.locator('#slot-b [data-slot="explore-more-trigger"]').click()
  await expect(page.locator('[data-feather-portal] [data-slot="explore-more-menu"]')).toBeVisible()
  expectHostUntouched(before, await hostState(page), { whileModalOpen: true })

  await page.keyboard.press("Escape")
  await expect(page.locator('[data-slot="explore-more-menu"]')).toHaveCount(0)
  expectHostUntouched(before, await hostState(page))
})

test("a: every rule of the stylesheet matches only inside a Feather root or by a class", async ({ page }) => {
  await mount(page, "slot-a", AD)
  const offenders = await page.evaluate(() => {
    const out: string[] = []
    // Splits a selector list at its top-level commas (not inside (), [] or after a backslash).
    const split = (list: string) => {
      const parts: string[] = []
      let depth = 0
      let from = 0
      for (let i = 0; i < list.length; i++) {
        const c = list[i]
        if (c === "\\") i++
        else if (c === "(" || c === "[") depth++
        else if (c === ")" || c === "]") depth--
        else if (c === "," && depth === 0) {
          parts.push(list.slice(from, i))
          from = i + 1
        }
      }
      parts.push(list.slice(from))
      return parts.map((p) => p.trim())
    }
    const sheet = [...document.styleSheets].find((s) => s.href?.endsWith("/feather-embed.css"))!
    const visit = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
          for (const selector of split(rule.selectorText)) if (!selector.includes("feather-root") && !selector.startsWith(".")) out.push(selector)
        } else if (!(rule instanceof CSSKeyframesRule) && !(rule instanceof CSSFontFaceRule) && "cssRules" in rule) visit((rule as CSSGroupingRule).cssRules)
      }
    }
    visit(sheet.cssRules)
    return out
  })
  expect(offenders).toEqual([])
})

test("b: the ad campaign renders in the host with Feather's geometry, font and colors", async ({ page }) => {
  await mount(page, "slot-a", AD)
  await expect(page.locator("#slot-a")).toContainText("Recommended test: 7 days, purchase objective")
  const root = await computed(page, "#slot-a [data-feather]", ["background-color", "color", "font-family"])
  expect(root["background-color"]).toBe("rgb(247, 247, 245)") // feather.json's background, not the host's #0b0d0c
  expect(root.color).toBe("rgb(24, 24, 27)")
  expect(root["font-family"]).toContain("JetBrains Mono")

  for (const name of ["Launch the recommended test", "Confirm spend…", "spend less", "set my own budget"]) {
    const button = page.locator("#slot-a [data-feather] button", { hasText: name })
    const box = await button.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { height: cs.height, radius: cs.borderTopLeftRadius, family: cs.fontFamily, border: cs.borderTopWidth, size: cs.fontSize }
    })
    expect(box, name).toMatchObject({ height: "44px", radius: "8px", border: "1px" })
    expect(box.family, name).toContain("JetBrains Mono")
    expect(box.size, name).not.toBe("16px") // Godpip's `button { font: inherit }` would give the page's size
  }

  // The radius hierarchy: a card is the card tier (12px), and the experience card holding cards is one step more (16px).
  const radius = (selector: string) => computed(page, selector, ["border-top-left-radius"]).then((s) => s["border-top-left-radius"])
  expect(await radius('#slot-a [data-slot="recommendation"]')).toBe("12px")
  expect(await radius('#slot-a [data-slot="irreversible-action"]')).toBe("12px")
  expect(await radius('#slot-a [data-slot="experience-card"]')).toBe("16px")

  expect((await computed(page, '#slot-a [data-slot="recommendation"]', ["background-color"]))["background-color"]).toBe("rgb(255, 255, 255)")
  // Only the destructive act is red (semantic color), and it is Feather's, not the host's --danger (#ffb4ab).
  const danger = (await computed(page, '#slot-a [data-slot="irreversible-action"]', ["border-top-color"]))["border-top-color"]
  expect(danger).not.toBe("rgb(255, 180, 171)")
  expect(danger).toMatch(/^rgb\(2[0-9]{2}, \d{1,2}, \d{1,2}\)$|^rgb\(1[5-9]\d, \d{1,2}, \d{1,2}\)$/)
})

test("c: arming then confirming the spend calls onReply with exactly the confirm reply", async ({ page }) => {
  await mount(page, "slot-a", AD)
  await page.getByRole("button", { name: /^Confirm spend…/ }).click()
  await expect(page.getByRole("button", { name: "Yes, confirm spend" })).toBeVisible()
  expect(await page.evaluate(() => window.__feather.replies)).toEqual([]) // arming is not an act
  await page.getByRole("button", { name: "Yes, confirm spend" }).click()
  await expect.poll(() => page.evaluate(() => window.__feather.replies.length)).toBe(1)
  const replies = await page.evaluate(() => window.__feather.replies)
  expect(replies[0]).toStrictEqual({ slot: "slot-a", reply: SPEND })
  expect(JSON.stringify(replies[0].reply)).toBe('{"experience":"approve_campaign","node":"go","act":"confirm"}')
})

test("d: a popup renders in the portal host, styled by Feather and not by the browser or the page", async ({ page }) => {
  await mount(page, "slot-b", NEWS)
  await page.locator('#slot-b [data-slot="explore-more-trigger"]').click()
  const menu = page.locator('[data-slot="explore-more-menu"]')
  await expect(menu).toBeVisible()
  expect(await page.locator('body > [data-feather-portal] [data-feather-portal-view] [data-slot="explore-more-menu"]').count()).toBe(1)
  expect(await page.locator("[data-feather-portal]").count()).toBe(1)
  expect(await page.locator('#slot-b [data-slot="explore-more-menu"]').count()).toBe(0)
  const style = await menu.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { border: cs.borderTopWidth, borderColor: cs.borderTopColor, radius: cs.borderTopLeftRadius, background: cs.backgroundColor, shadow: cs.boxShadow, family: cs.fontFamily, z: cs.zIndex }
  })
  expect(style.border).toBe("1px")
  expect(style.radius).toBe("12px")
  expect(style.background).toBe("rgb(255, 255, 255)")
  expect(style.shadow).not.toBe("none")
  expect(style.family).toContain("JetBrains Mono")
  expect(style.borderColor).not.toBe("rgb(0, 0, 0)") // the UA default border color
  const item = await page.locator('[data-slot="explore-more-topic"]').first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { height: cs.minHeight, family: cs.fontFamily }
  })
  expect(item.family).toContain("JetBrains Mono")
  await page.locator('[data-slot="explore-more-topic"]', { hasText: "medical research" }).click()
  await expect.poll(() => page.evaluate(() => window.__feather.replies.length)).toBe(1)
  expect((await page.evaluate(() => window.__feather.replies))[0].reply).toStrictEqual({ experience: "read_article", node: "explore", act: "expand", value: "medical research" })
})

test("e: feather-dark and a brand tokens object apply only inside the Feather roots", async ({ page }) => {
  await remember(page)
  const before = await hostState(page)
  const BRAND = {
    schema: "feather-tokens/2",
    colors: { background: "#FFF8F0", surface: "#FFFFFF", text: "#2B1B12", primary: "#B4232A", primaryText: "#FFFFFF" },
    typography: { fontFamily: { display: "JetBrains Mono", body: "JetBrains Mono" } },
    shape: "sharp",
    density: "compact",
    elevation: "flat",
    motion: "snappy",
  }
  await mount(page, "slot-a", AD, { theme: "feather-dark" })
  await mount(page, "slot-b", AD, { theme: BRAND })

  const dark = await computed(page, "#slot-a [data-feather]", ["background-color", "color", "color-scheme"])
  expect(dark["background-color"]).toBe("rgb(12, 12, 14)")
  expect(dark["color-scheme"]).toBe("dark")
  expect(await page.locator("#slot-a [data-feather]").getAttribute("class")).toBe("feather-root dark")
  expect(await page.locator("#slot-a [data-slot=recommendation]").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(22, 22, 26)")

  const brand = await computed(page, "#slot-b [data-feather]", ["background-color", "color-scheme"])
  expect(brand["background-color"]).toBe("rgb(255, 248, 240)")
  expect(brand["color-scheme"]).toBe("light")
  // Sharp shape: the button radius is 0, where the default (rounded) is 8px.
  expect((await computed(page, '#slot-b [data-slot="irreversible-action-arm"]', ["border-top-left-radius", "height"]))["border-top-left-radius"]).toBe("0px")
  expect((await computed(page, '#slot-a [data-slot="irreversible-action-arm"]', ["border-top-left-radius"]))["border-top-left-radius"]).toBe("8px")

  // One <style> for the brand, every selector of it tied to that brand's roots.
  const rules = await page.evaluate(() => [...document.querySelectorAll("style[data-feather-theme-style]")].map((s) => ({ id: s.getAttribute("data-feather-theme-style"), selectors: [...(s as HTMLStyleElement).sheet!.cssRules].map((r) => (r as CSSStyleRule).selectorText) })))
  expect(rules).toHaveLength(1)
  expect(rules[0].selectors.length).toBeGreaterThan(3)
  for (const sel of rules[0].selectors) expect(sel).toContain(`.feather-root`)
  expect(rules[0].selectors.every((s) => s.includes(`[data-feather-theme="${rules[0].id}"]`))).toBe(true)

  expectHostUntouched(before, await hostState(page))
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false)
})

test("e: a dark view's popup is dark too", async ({ page }) => {
  await mount(page, "slot-a", NEWS, { theme: "feather-dark" })
  await page.locator('#slot-a [data-slot="explore-more-trigger"]').click()
  const menu = page.locator('[data-slot="explore-more-menu"]')
  await expect(menu).toBeVisible()
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgb(255, 255, 255)")
  expect(await page.locator("[data-feather-portal-view]").getAttribute("class")).toBe("feather-root dark")
})

test("f: invalid IR reports issues and renders nothing; update swaps the experience; unmount leaves the page as it was", async ({ page }) => {
  const html = await page.evaluate(() => document.documentElement.outerHTML)
  await remember(page)
  const before = await hostState(page)

  await mount(page, "slot-a", { ir: "feather.ir/0", experience: "x", nodes: [{ type: "Nope", id: "a" }] })
  await expect.poll(() => page.evaluate(() => window.__feather.issues.length)).toBeGreaterThan(0)
  const issues = await page.evaluate(() => window.__feather.issues[0])
  expect(issues.slot).toBe("slot-a")
  expect(issues.issues.length).toBeGreaterThan(0)
  expect(issues.issues[0].code).toBeTruthy()
  expect(await page.locator("#slot-a [data-feather]").evaluate((el) => el.innerHTML)).toBe("")
  expect(await page.evaluate(() => window.__feather.replies)).toEqual([])

  await page.evaluate((ad) => window.__feather.views["slot-a"].update(ad), AD)
  await expect(page.locator("#slot-a")).toContainText("Recommended test: 7 days, purchase objective")
  await page.evaluate((news) => window.__feather.views["slot-a"].update(news), NEWS)
  await expect(page.locator("#slot-a")).toContainText("New AI Model Shows Promise in Medical Diagnosis")
  await expect(page.locator("#slot-a")).not.toContainText("Recommended test")

  await page.locator('#slot-a [data-slot="explore-more-trigger"]').click()
  await expect(page.locator('[data-slot="explore-more-menu"]')).toBeVisible()
  await page.evaluate(() => window.__feather.views["slot-a"].unmount()) // with the popup open

  await expect(page.locator("[data-feather], [data-feather-portal]")).toHaveCount(0)
  expect(await page.locator("link[data-feather-embed-css], style[data-feather-theme-style]").count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.outerHTML)).toBe(html)
  expectHostUntouched(before, await hostState(page))
  // Unmounting twice, and updating after it, are no-ops.
  await page.evaluate(() => {
    window.__feather.views["slot-a"].unmount()
    window.__feather.views["slot-a"].update({})
  })
  expect(await page.evaluate(() => document.documentElement.outerHTML)).toBe(html)
})

test("g: two views at once work independently", async ({ page }) => {
  await mount(page, "slot-a", AD)
  await mount(page, "slot-b", NEWS, { theme: "feather-dark" })
  await expect(page.locator("[data-feather]")).toHaveCount(2)
  await expect(page.locator("[data-feather-portal]")).toHaveCount(1)
  await expect(page.locator("[data-feather-portal-view]")).toHaveCount(2)

  await page.locator("#slot-a").getByRole("button", { name: /^Confirm spend…/ }).click()
  await page.locator("#slot-a").getByRole("button", { name: "Yes, confirm spend" }).click()
  await expect.poll(() => page.evaluate(() => window.__feather.replies.map((r) => r.slot))).toEqual(["slot-a"])

  await page.locator('#slot-b [data-slot="explore-more-trigger"]').click()
  await page.locator('[data-slot="explore-more-topic"]', { hasText: "healthcare technology" }).click()
  await expect.poll(() => page.evaluate(() => window.__feather.replies.map((r) => r.slot))).toEqual(["slot-a", "slot-b"])
  expect((await page.evaluate(() => window.__feather.replies))[1].reply).toMatchObject({ experience: "read_article", value: "healthcare technology" })

  // Updating one leaves the other as it was; unmounting one keeps the shared parts for the other.
  await page.evaluate((news) => window.__feather.views["slot-a"].update(news), NEWS)
  await expect(page.locator("#slot-a")).toContainText("New AI Model Shows Promise")
  await page.evaluate(() => window.__feather.views["slot-a"].unmount())
  await expect(page.locator("[data-feather]")).toHaveCount(1)
  await expect(page.locator("#slot-b")).toContainText("New AI Model Shows Promise")
  await expect(page.locator("[data-feather-portal]")).toHaveCount(1)
  expect(await page.locator("link[data-feather-embed-css]").count()).toBe(1)
  await page.locator('#slot-b [data-slot="explore-more-trigger"]').click()
  await expect(page.locator('[data-slot="explore-more-menu"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await page.evaluate(() => window.__feather.views["slot-b"].unmount())
  await expect(page.locator("[data-feather-portal]")).toHaveCount(0)
})

test("h: reduced motion is respected, nothing is stored and no listener outlives the views", async ({ page, context }) => {
  await context.addInitScript(() => {
    const live = new Map<string, number>()
    const key = (t: string, target: string) => `${target}:${t}`
    for (const [target, obj] of [["window", window], ["document", document]] as const) {
      const add = obj.addEventListener.bind(obj)
      const remove = obj.removeEventListener.bind(obj)
      const seen = new Map<EventListenerOrEventListenerObject, Set<string>>()
      obj.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
        // A `once` listener removes itself when it fires, which is not seen from here; it is not counted.
        if (listener && !(typeof options === "object" && options?.once)) {
          const capture = typeof options === "boolean" ? options : !!options?.capture
          const id = `${type}/${capture}`
          const set = seen.get(listener) ?? new Set()
          if (!set.has(id)) {
            set.add(id)
            seen.set(listener, set)
            live.set(key(type, target), (live.get(key(type, target)) ?? 0) + 1)
          }
        }
        add(type, listener as EventListener, options)
      }
      obj.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
        if (listener) {
          const capture = typeof options === "boolean" ? options : !!options?.capture
          const id = `${type}/${capture}`
          if (seen.get(listener)?.delete(id)) live.set(key(type, target), (live.get(key(type, target)) ?? 0) - 1)
        }
        remove(type, listener as EventListener, options)
      }
    }
    ;(window as unknown as { __live: () => Record<string, number> }).__live = () => Object.fromEntries([...live].filter(([, n]) => n !== 0))
    const stores: string[] = []
    for (const m of ["setItem", "getItem", "removeItem"] as const) {
      const orig = Storage.prototype[m] as (this: Storage, ...args: string[]) => unknown
      Storage.prototype[m] = function (this: Storage, ...args: string[]) {
        stores.push(m)
        return orig.apply(this, args)
      } as never
    }
    ;(window as unknown as { __stores: string[] }).__stores = stores
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await page.waitForFunction(() => window.__featherReady)
  const baseline = await page.evaluate(() => (window as unknown as { __live: () => Record<string, number> }).__live())

  await mount(page, "slot-a", NEWS)
  const motion = await computed(page, '#slot-a [data-slot="explore-more-trigger"]', ["transition-duration", "animation-duration"])
  expect(motion["transition-duration"]).toBe("1e-05s")
  await page.locator('#slot-a [data-slot="explore-more-trigger"]').click()
  await expect(page.locator('[data-slot="explore-more-menu"]')).toBeVisible()
  expect((await computed(page, '[data-slot="explore-more-menu"]', ["transition-duration"]))["transition-duration"]).toBe("1e-05s")
  await page.keyboard.press("Escape")
  await page.evaluate(() => window.__feather.views["slot-a"].unmount())

  const after = await page.evaluate(() => (window as unknown as { __live: () => Record<string, number> }).__live())
  // React registers `selectionchange` once on the document, for the life of the page; that is the only one left.
  const left = Object.fromEntries(Object.entries(after).filter(([k, n]) => (baseline[k] ?? 0) !== n))
  expect(Object.keys(left).filter((k) => k !== "document:selectionchange")).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { __stores: string[] }).__stores)).toEqual([])
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0)
})

test("the bundle exports mount, validate, validateReply and version", async ({ page }) => {
  const api = await page.evaluate(() => ({
    keys: Object.keys(window.__feather.embed).sort(),
    version: window.__feather.embed.version,
    good: window.__feather.embed.validate(JSON.parse("null")).ok,
  }))
  expect(api.keys).toEqual(["mount", "validate", "validateReply", "version"])
  expect(api.version).toMatch(/^\d+\.\d+\.\d+$/)
  expect(api.good).toBe(false)
  expect(await page.evaluate((ad) => window.__feather.embed.validate(ad).ok, AD)).toBe(true)
  expect(await page.evaluate(([ad, reply]) => window.__feather.embed.validateReply(ad, reply).ok, [AD, SPEND] as const)).toBe(true)
})

test("i: a Form in the host sends one reply with only the filled fields, and Enter in a field submits", async ({ page }) => {
  const POSTER = fixture("poster-details-form")
  await mount(page, "slot-a", POSTER)
  const form = page.locator('#slot-a [data-slot="form-group"]')
  await expect(form).toBeVisible()
  // The host's own button and input rules do not reach it: one real submit button, in Feather's geometry.
  await expect(form.locator('[data-slot="form-group-submit"]')).toHaveCount(1)
  expect(await form.locator('[data-slot="form-group-control"]').first().evaluate((el) => getComputedStyle(el).height)).toBe("44px")

  await form.getByLabel("Market time").fill("Saturdays, 8am to 1pm")
  await form.getByLabel("Stall fee").fill("150")
  await form.locator('[data-slot="form-group-submit"]').click()
  await expect.poll(() => page.evaluate(() => window.__feather.replies.length)).toBe(1)
  const replies = await page.evaluate(() => window.__feather.replies)
  expect(replies[0]).toStrictEqual({ slot: "slot-a", reply: { experience: "poster_details", node: "details", act: "submit", value: { market_time: "Saturdays, 8am to 1pm", stall_fee: 150 } } })
  await expect(form).toHaveAttribute("data-variant", "sent")
  await expect(form.locator('[data-slot="form-group-status"]')).toContainText("Sent.")
  expect(await page.evaluate(() => window.__feather.issues)).toEqual([])

  // Typing in a field and pressing Enter submits, as a native form does.
  await page.evaluate(() => window.__feather.views["slot-a"]!.unmount())
  await mount(page, "slot-b", POSTER)
  const second = page.locator('#slot-b [data-slot="form-group"]')
  await second.getByLabel("Contact email").fill("market@example.com")
  await second.getByLabel("Contact email").press("Enter")
  await expect.poll(() => page.evaluate(() => window.__feather.replies.length)).toBe(2)
  expect((await page.evaluate(() => window.__feather.replies))[1]).toStrictEqual({ slot: "slot-b", reply: { experience: "poster_details", node: "details", act: "submit", value: { contact: "market@example.com" } } })
})
