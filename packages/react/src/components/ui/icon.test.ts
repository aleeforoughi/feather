import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, PlayIcon, TriangleAlertIcon, TriangleIcon } from "lucide-react"
import { describe, expect, it } from "vitest"
import { OPTICAL, OPTICAL_BUDGET, iconName, opticalFor, opticalViewBox, withinBudget } from "../../lib/optical"
import { Icon, type IconProps } from "./icon"

const html = (props: IconProps) => renderToStaticMarkup(React.createElement(Icon, props))
const attr = (markup: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(markup)?.[1]

describe("the optical registry", () => {
  it("names lucide icons in kebab-case", () => {
    expect(iconName("TriangleAlert")).toBe("triangle-alert")
    expect(iconName("Play")).toBe("play")
    expect(iconName(undefined)).toBeUndefined()
  })

  it("keeps every entry inside the budget at every slot size", () => {
    for (const [name, optical] of Object.entries(OPTICAL)) {
      for (const size of [16, 20, 24]) expect(withinBudget(optical, size), `${name} at ${size}px`).toBe(true)
      expect(optical.scale).toBeGreaterThanOrEqual(OPTICAL_BUDGET.minScale)
      expect(optical.scale).toBeLessThanOrEqual(OPTICAL_BUDGET.maxScale)
    }
  })

  it("clamps a correction to one pixel at the rendered size", () => {
    for (const [name] of Object.entries(OPTICAL)) {
      for (const size of [16, 20, 24, 32]) {
        const o = opticalFor(name, size)
        expect(withinBudget(o, size), `${name} at ${size}px`).toBe(true)
      }
    }
    // 0.5 of a 24 unit is 0.5px at 24px; at 32px a unit is 1.33px, so a full unit shift would pass the budget: it is clamped.
    expect((opticalFor("play", 32).dx * 32) / 24).toBeLessThanOrEqual(1)
  })

  it("leaves an icon with no entry alone", () => {
    expect(opticalFor("check", 24)).toEqual({ scale: 1, dx: 0, dy: 0 })
    expect(opticalFor(undefined, 24)).toEqual({ scale: 1, dx: 0, dy: 0 })
  })

  it("turns a correction into a viewBox: scale shows fewer units, a shift moves the view the other way", () => {
    expect(opticalViewBox({ scale: 1, dx: 0, dy: 0 })).toBe("0 0 24 24")
    expect(opticalViewBox({ scale: 1, dx: 1, dy: 0 })).toBe("-1 0 24 24")
    expect(opticalViewBox({ scale: 1, dx: 0, dy: -1 })).toBe("0 1 24 24")
    const [x, , w] = opticalViewBox({ scale: 1.04, dx: 0, dy: 0 }).split(" ").map(Number)
    expect(w).toBeCloseTo(24 / 1.04, 3)
    expect(x).toBeCloseTo(12 - w / 2, 3)
  })

  it("seeds the asymmetric glyphs Feather uses", () => {
    for (const name of ["play", "triangle", "triangle-alert", "chevron-right", "chevron-left", "chevron-up", "chevron-down"]) expect(OPTICAL[name]).toBeDefined()
  })
})

describe("Icon", () => {
  it("renders the slot size, with a slot and a variant", () => {
    for (const size of [16, 20, 24, 32] as const) {
      const out = html({ icon: CheckIcon, size })
      expect(attr(out, "width")).toBe(String(size))
      expect(attr(out, "height")).toBe(String(size))
      expect(attr(out, "data-slot")).toBe("icon")
      expect(attr(out, "data-variant")).toBe(String(size))
    }
  })

  it("follows the density's icon slot by default", () => {
    const out = html({ icon: CheckIcon })
    expect(attr(out, "data-variant")).toBe("slot")
    expect(attr(out, "class")).toContain("size-icon-slot")
  })

  it("leaves an uncorrected glyph's viewBox alone and corrects a registered one", () => {
    expect(attr(html({ icon: CheckIcon, size: 24 }), "viewBox")).toBe("0 0 24 24")
    const play = attr(html({ icon: PlayIcon, size: 24 }), "viewBox")
    expect(play).not.toBe("0 0 24 24")
    expect(play).toBe(opticalViewBox(opticalFor("play", 24)))
  })

  it("registers every glyph the registry names under the name lucide gives its component", () => {
    for (const [glyph, name] of [
      [PlayIcon, "play"],
      [TriangleIcon, "triangle"],
      [TriangleAlertIcon, "triangle-alert"],
      [ChevronRightIcon, "chevron-right"],
      [ChevronLeftIcon, "chevron-left"],
      [ChevronUpIcon, "chevron-up"],
      [ChevronDownIcon, "chevron-down"],
    ] as const) {
      expect(iconName(glyph.displayName)).toBe(name)
      expect(attr(html({ icon: glyph, size: 24 }), "viewBox")).not.toBe("0 0 24 24")
    }
  })

  it("is hidden from assistive technology unless it is labelled", () => {
    expect(attr(html({ icon: CheckIcon }), "aria-hidden")).toBe("true")
    expect(attr(html({ icon: CheckIcon, "aria-label": "Done" }), "aria-hidden")).toBeUndefined()
  })
})
