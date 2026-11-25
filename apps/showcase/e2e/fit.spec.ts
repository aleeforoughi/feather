import { expect, test, type Page } from "@playwright/test"

// The fit gate (docs/visual-system.md section 14.1, "Fit"): display type never runs past its box, never overlaps the
// copy around it, and never breaks inside a word that would fit. fit.html renders every hero, numbers, statement, case
// and timeline variant at loudness 0 and 3 (and the stacked hero at 2) in stress copy: German compounds, titles over
// 60 characters, an <em> in the title, long units and word values. One page per brand, measured at a phone, a tablet
// and a desktop width. The marquee's moving track is exempt (it scrolls by design; its clone is aria-hidden).
const BRANDS = ["studio", "portrait", "seed"]
const WIDTHS = [390, 820, 1440]

/** Scrolls the page through so every block has entered (titles, counters), then waits for every finite animation. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const end = document.documentElement.scrollHeight
    const step = Math.max(400, Math.round(window.innerHeight * 0.8))
    for (let y = 0; y < end; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)))
    }
    window.scrollTo(0, 0)
    await Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 4000)),
    ])
    await document.fonts.ready
  })
  // Counters tween for up to 1.2s after they enter; the swap's first change is 2.4s away.
  await page.waitForTimeout(1300)
}

/** Wraps the word "making" of every title in an <em>, as a composed page marks its emphasised word. Idempotent. */
async function emphasise(page: Page) {
  await page.evaluate(() => {
    const titles = document.querySelectorAll('[data-fit-doc] :is(h1, h2, [data-slot="display-title"])')
    for (const title of titles) {
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT)
      const hits: Text[] = []
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/\bmaking\b/i.test(n.textContent ?? "") && !n.parentElement?.closest("em, .sr-only")) hits.push(n as Text)
      for (const node of hits) {
        const text = node.textContent ?? ""
        const at = text.search(/\bmaking\b/i)
        const word = node.splitText(at)
        word.splitText(6)
        const em = document.createElement("em")
        word.replaceWith(em)
        em.appendChild(word)
      }
    }
  })
}

/** Every fit problem on the page at the current width, as readable lines. */
async function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const vw = document.documentElement.clientWidth
    const root = getComputedStyle(document.documentElement)
    const rem = parseFloat(root.fontSize) || 16
    const floorVar = root.getPropertyValue("--display-fit-floor").trim()
    const floor = floorVar.endsWith("rem") ? parseFloat(floorVar) * rem : parseFloat(floorVar) || 1.5 * rem
    const name = (el: Element) => {
      const slot = el.getAttribute("data-slot")
      return `${el.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}${el.id ? `#${el.id}` : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`
    }
    const exempt = (el: Element) => !!el.closest('[data-slot="marquee-track"], .sr-only, [aria-hidden="true"][inert], [data-piece="swap-word"][data-state="idle"]')
    const positioned = (el: Element) => {
      for (let e: Element | null = el; e && !e.matches("[data-block]"); e = e.parentElement) {
        const p = getComputedStyle(e).position
        if (p === "absolute" || p === "fixed") return true
      }
      return false
    }
    const scrolled = (el: Element) => {
      for (let e = el.parentElement; e && !e.matches("[data-block]"); e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return true
      return false
    }
    const ownText = (el: Element) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "")
    const contentRight = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth)
    }
    const meets = (a: DOMRect, b: DOMRect) => a.width > 0 && b.width > 0 && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

    for (const doc of document.querySelectorAll<HTMLElement>("[data-fit-doc]")) {
      for (const section of doc.querySelectorAll<HTMLElement>("[data-block]")) {
        const tag = `${doc.dataset.fitDoc} ${section.dataset.block}${section.dataset.blockVariant ? `:${section.dataset.blockVariant}` : ""}`
        const edge = Math.min(section.getBoundingClientRect().right, vw) + 1

        // No overflow: text inside its own box and its parent's content box; nothing past the block or the viewport.
        for (const el of section.querySelectorAll<HTMLElement>("*")) {
          if (exempt(el) || positioned(el)) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          if (!scrolled(el) && r.right > edge) out.push(`${tag}: ${name(el)} runs ${Math.round(r.right - edge + 1)}px past the ${r.right > vw + 1 ? "viewport" : "block"}`)
          if (!ownText(el)) continue
          const s = getComputedStyle(el)
          if (s.display !== "inline" && !/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${tag}: ${name(el)} overflows itself by ${el.scrollWidth - el.clientWidth}px`)
          const parent = el.parentElement
          if (parent && r.right > contentRight(parent) + 1) out.push(`${tag}: ${name(el)} runs ${Math.round(r.right - contentRight(parent))}px past its box`)
        }

        // No overlap: the hero's eyebrow, title, lede and acts. The title's box includes its glyphs (a display line set
        // under 1 hangs them out of the element's box), so the gap is measured from what is drawn.
        if (section.dataset.block === "hero") {
          const glyphs = (el: Element) => {
            const box = el.getBoundingClientRect()
            let [top, bottom] = [box.top, box.bottom]
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (exempt(n.parentElement!)) continue
              const range = document.createRange()
              range.selectNodeContents(n)
              for (const r of range.getClientRects()) if (r.width > 0) [top, bottom] = [Math.min(top, r.top), Math.max(bottom, r.bottom)]
            }
            return new DOMRect(box.left, top, box.width, bottom - top)
          }
          const parts = [
            ["eyebrow", section.querySelector('[data-slot="hero-eyebrow"]')],
            ["title", section.querySelector("h1")],
            ["lede", section.querySelector('[data-slot="hero-lede"]')],
            ["acts", section.querySelector('[data-slot="hero-acts-row"], [data-slot="hero-actions"]')],
          ].filter((p): p is [string, Element] => !!p[1])
          for (let i = 0; i < parts.length; i++)
            for (let j = i + 1; j < parts.length; j++) {
              const a = parts[i][0] === "title" ? glyphs(parts[i][1]) : parts[i][1].getBoundingClientRect()
              const b = parts[j][0] === "title" ? glyphs(parts[j][1]) : parts[j][1].getBoundingClientRect()
              if (meets(a, b)) out.push(`${tag}: the ${parts[i][0]} and the ${parts[j][0]} overlap by ${Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))}px`)
            }
        }

        // No mid-word break: each word of a title in one line box, unless it cannot fit even at the floor (then it may
        // hyphenate, and only where hyphens: auto and a lang say so).
        const titles = section.querySelectorAll<HTMLElement>('h1, h2:not(.sr-only), [data-slot="number-value"], [data-slot="timeline-when"]')
        for (const title of titles) {
          if (exempt(title) || title.closest('[data-slot="marquee"]')) continue
          // A fitted title keeps its letters apart: its tracking never tighter than the bounds allow a brand (-0.08em,
          // run 25% tighter by the bold contrast), whatever size the fit gave it.
          const ts = getComputedStyle(title)
          const em = parseFloat(ts.letterSpacing) / parseFloat(ts.fontSize)
          if (em < -0.1) out.push(`${tag}: ${name(title)} is tracked at ${em.toFixed(3)}em at ${Math.round(parseFloat(ts.fontSize))}px`)
          const chars: { node: Text; i: number }[] = []
          const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT)
          for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
            if (exempt(n.parentElement!)) continue
            const t = n.textContent ?? ""
            for (let i = 0; i < t.length; i++) chars.push({ node: n, i })
          }
          const words: { node: Text; i: number }[][] = []
          let word: { node: Text; i: number }[] = []
          for (const c of chars) {
            const ch = c.node.textContent![c.i]
            if (/\s/.test(ch) && ch !== " ") {
              if (word.length) words.push(word)
              word = []
            } else word.push(c)
          }
          if (word.length) words.push(word)
          // Two characters are on different lines when their tops are more than half the type size apart.
          const half = parseFloat(getComputedStyle(title).fontSize) * 0.5
          for (const w of words) {
            const tops: number[] = []
            for (const c of w) {
              const range = document.createRange()
              range.setStart(c.node, c.i)
              range.setEnd(c.node, c.i + 1)
              for (const rect of range.getClientRects()) if (rect.width > 0) tops.push(rect.top)
            }
            tops.sort((a, b) => a - b)
            if (tops.every((t) => t - tops[0] <= half)) continue
            const text = w.map((c) => c.node.textContent![c.i]).join("")
            const holder = w[0].node.parentElement!
            const hs = getComputedStyle(holder)
            const size = parseFloat(hs.fontSize)
            const probe = document.createElement("span")
            probe.textContent = text
            probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${hs.font};letter-spacing:${hs.letterSpacing};text-transform:${hs.textTransform};font-feature-settings:${hs.fontFeatureSettings}`
            document.body.appendChild(probe)
            const natural = probe.getBoundingClientRect().width
            probe.remove()
            const room = title.clientWidth - parseFloat(getComputedStyle(title).paddingLeft) - parseFloat(getComputedStyle(title).paddingRight)
            const hyphenated = (hs.hyphens || (hs as unknown as { webkitHyphens: string }).webkitHyphens) === "auto" && !!holder.closest("[lang]")?.getAttribute("lang")
            if (natural <= room + 1) out.push(`${tag}: ${name(title)} breaks inside "${text}", which fits its ${Math.round(room)}px at ${Math.round(size)}px`)
            else if (size > floor + 0.5) out.push(`${tag}: ${name(title)} breaks inside "${text}" at ${Math.round(size)}px instead of stepping down (floor ${Math.round(floor)}px)`)
            else if (!hyphenated) out.push(`${tag}: ${name(title)} breaks inside "${text}" without hyphens: auto and a lang`)
          }
        }
      }
    }
    return out
  })
}

for (const brand of BRANDS) {
  test(`fit, ${brand}: no overflow, no overlap, no mid-word break at ${WIDTHS.join(", ")}px`, async ({ page }) => {
    test.setTimeout(180_000)
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.setViewportSize({ width: WIDTHS[0], height: 900 })
    await page.goto(`/fit.html?brand=${brand}`, { waitUntil: "networkidle" })
    await page.locator("[data-fit-doc]").last().waitFor()
    expect(errors).toEqual([])
    expect(await page.locator("[data-fit-doc]").count()).toBeGreaterThan(20)
    const found: string[] = []
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await settle(page)
      await emphasise(page)
      found.push(...(await problems(page)).map((p) => `${width}px ${p}`))
    }
    expect(errors).toEqual([])
    expect(found).toEqual([])
  })
}
