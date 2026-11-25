// The page layouts (feather.page/1 `layout`): the knob validates like every knob, and the plan (which section takes a
// ground or a hang, the two-colour ink, the contrast of every ground) is deterministic and measured in the brand.
import { buildTheme, contrastRatio, oklabMix, type BrandTokens } from "@aleeforoughi/feather-tokens"
import studio from "@aleeforoughi/feather-tokens/themes/studio.json"
import portrait from "@aleeforoughi/feather-tokens/themes/portrait.json"
import seed from "@aleeforoughi/feather-tokens/themes/seed.json"
import { describe, expect, it } from "vitest"
import { LAYOUTS, LAYOUT_SKIPS, PAGE_KNOBS, SECONDARY_INK } from "./spec"
import { LAYOUT_FLOOR, layoutPlan, layoutSections, resolveColor, themeVars } from "./layouts"
import { validatePage } from "./validate"
import type { PageBlock } from "./types"

const BRANDS = { studio, portrait, seed } as Record<string, { tokens: unknown }>
const css = (tokens: unknown) => {
  const t = buildTheme(tokens)
  if (!t.ok) throw new Error(t.problems.join("\n"))
  return t.css
}
const doc = (extra: Record<string, unknown>) => ({ schema: "feather.page/1", brand: "brand.json", sections: [{ block: "hero", title: "A title" }], ...extra })
const blocks = (...kinds: string[]) => kinds.map((block) => ({ block, title: "T" }) as unknown as PageBlock)

describe("the layout knob", () => {
  it("takes the six layouts and nothing else", () => {
    expect([...LAYOUTS]).toEqual(["editorial", "swiss", "brutalist", "poster", "colour-blocking", "two-colour"])
    expect(PAGE_KNOBS.layout).toMatchObject({ kind: "enum", values: LAYOUTS })
    for (const layout of LAYOUTS) expect(validatePage(doc({ layout })).ok, layout).toBe(true)
    const r = validatePage(doc({ layout: "grid" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues).toEqual([expect.objectContaining({ path: "/layout", code: "unknown-variant" })])
  })

  it("is feather.page/1's: on a /0 page it is needs-schema-1", () => {
    const r = validatePage(doc({ schema: "feather.page/0", layout: "swiss" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.issues).toEqual([expect.objectContaining({ path: "/layout", code: "needs-schema-1" })])
  })
})

describe("layoutSections", () => {
  it("colour-blocking: every other section on the next colour block, past a toned block or a form", () => {
    const sections = [...blocks("hero", "work", "statement", "form", "quote", "faq", "numbers", "case", "logos", "contact", "offer"), { block: "process", tone: "inverse", steps: [] } as unknown as PageBlock]
    expect(layoutSections("colour-blocking", sections).map((s) => s.ground ?? null)).toEqual([null, "block-1", null, null, null, "block-2", null, "block-3", null, "block-4", null, null])
  })

  it("keeps every block with native controls on the page ground", () => {
    for (const kind of LAYOUT_SKIPS["colour-blocking"]) expect(layoutSections("colour-blocking", blocks("hero", kind))[1], kind).toEqual({})
  })

  it("editorial hangs every other section, never the first; the other layouts place nothing", () => {
    expect(layoutSections("editorial", blocks("hero", "work", "quote", "contact"))).toEqual([{}, { hang: true }, {}, { hang: true }])
    for (const layout of ["swiss", "brutalist", "poster", "two-colour", undefined] as const) expect(layoutSections(layout, blocks("hero", "work"))).toEqual([{}, {}])
  })
})

describe("resolveColor", () => {
  it("follows var() and evaluates an oklab color-mix, as the browser does", () => {
    const vars = { "--a": "#ffffff", "--b": "var(--a)", "--c": "color-mix(in oklab, var(--b) 40%, #000000)" }
    expect(resolveColor("var(--b)", vars)).toBe("#ffffff")
    expect(resolveColor("var(--c)", vars)).toBe(oklabMix("#ffffff", "#000000", 40))
    expect(resolveColor("rgb(0 0 0 / 0.5)", vars)).toBeNull()
    expect(resolveColor("var(--missing)", vars)).toBeNull()
  })

  it("reads a non-/4 brand's colour blocks through foundation.css's defaults", () => {
    const vars = themeVars(css({ colors: { primary: "#1f4fd1", background: "#ffffff", surface: "#f5f5f5", text: "#111111" }, typography: { fontFamily: { display: "Inter", body: "Inter" } } }))
    expect(vars["--block-1"]).toBeUndefined()
    expect(resolveColor("var(--block-1)", vars)).toBe(resolveColor(vars["--primary"], vars))
    expect(resolveColor("var(--block-3)", vars)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("layoutPlan in the reference brands", () => {
  for (const [name, brand] of Object.entries(BRANDS)) {
    it(`${name}: colour-blocking carries all four blocks at ${LAYOUT_FLOOR}:1, with the secondary tint`, () => {
      const sections = blocks("hero", "work", "quote", "faq", "numbers", "case", "logos", "contact")
      const plan = layoutPlan("colour-blocking", sections, [css(brand.tokens)])
      expect(plan.issues).toEqual([])
      expect(plan.sections.filter((s) => s.ground).length).toBe(4)
      const vars = themeVars(css(brand.tokens))
      for (const n of [1, 2, 3, 4]) {
        const ground = resolveColor(`var(--block-${n})`, vars)!
        const ink = resolveColor(`var(--block-${n}-ink)`, vars)!
        expect(contrastRatio(oklabMix(ink, ground, SECONDARY_INK), ground), `block-${n}`).toBeGreaterThanOrEqual(LAYOUT_FLOOR)
      }
    })

    it(`${name}: two-colour picks an ink that reads both ways`, () => {
      const plan = layoutPlan("two-colour", blocks("hero"), [css(brand.tokens)])
      expect(plan.issues).toEqual([])
      expect(["primary", "text"]).toContain(plan.ink)
    })
  }

  it("two-colour prints in the primary where it reads, and in the text colour where it does not", () => {
    const base = { typography: { fontFamily: { display: "Inter", body: "Inter" } } }
    const reads = layoutPlan("two-colour", blocks("hero"), [css({ ...base, colors: { primary: "#1f3fd1", background: "#ffffff", surface: "#f5f5f5", text: "#111111" } })])
    expect(reads.ink).toBe("primary")
    const pale = layoutPlan("two-colour", blocks("hero"), [css({ ...base, colors: { primary: "#f2c94c", background: "#ffffff", surface: "#f5f5f5", text: "#111111" } })])
    expect(pale.ink).toBe("text")
    expect(layoutPlan("two-colour", blocks("hero"), []).ink).toBe("text")
  })

  it("reports a contradiction at /layout when a colour block cannot carry its sections", () => {
    const vars = `:root:root {\n  --background: #ffffff;\n  --block-1: #ffffff;\n  --block-1-ink: #dddddd;\n}`
    const plan = layoutPlan("colour-blocking", blocks("hero", "work"), [vars])
    expect(plan.issues).toEqual([expect.objectContaining({ path: "/layout", code: "contradiction" })])
    expect(plan.issues[0].message).toMatch(/block-1/)
  })

  it("reports a contradiction when two-colour has no ink that reads", () => {
    const vars = `:root:root {\n  --background: #ffffff;\n  --primary: #eeeeee;\n  --text-primary: #cccccc;\n}`
    expect(layoutPlan("two-colour", blocks("hero"), [vars]).issues).toEqual([expect.objectContaining({ path: "/layout", code: "contradiction" })])
  })

  it("measures the scheme's other set too", () => {
    const good = `:root:root {\n  --block-1: #000000;\n  --block-1-ink: #ffffff;\n}`
    const bad = `:root:root {\n  --block-1: #777777;\n  --block-1-ink: #888888;\n}`
    expect(layoutPlan("colour-blocking", blocks("hero", "work"), [good]).issues).toEqual([])
    const plan = layoutPlan("colour-blocking", blocks("hero", "work"), [good, bad])
    expect(plan.issues[0].message).toMatch(/other set/)
  })

  it("is the same plan every time", () => {
    const sections = blocks("hero", "work", "quote", "faq")
    const theme = css((BRANDS.seed as { tokens: BrandTokens }).tokens)
    expect(layoutPlan("colour-blocking", sections, [theme])).toEqual(layoutPlan("colour-blocking", sections, [theme]))
  })
})
