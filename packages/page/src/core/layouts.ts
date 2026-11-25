// The page layouts (feather.page/1 `layout`, wave 5 part C): what a layout decides that CSS cannot. foundation.css draws
// each layout from `main[data-layout]`; this module says which section takes which ground or hang, which ink a
// two-colour page prints in, and whether the brand's own colours can carry the grounds a layout introduces. Pure and
// deterministic: the same page and theme give the same plan.
import { contrastRatio, oklabMix } from "@aleeforoughi/feather-tokens"
import { LAYOUT_GROUNDS, LAYOUT_SKIPS, SECONDARY_INK } from "./spec"
import type { PageBlock, PageIssue, PageLayout } from "./types"

/** The text floor every ground a layout introduces is held to (WCAG 2.2 AA, 1.4.3). */
export const LAYOUT_FLOOR = 4.5

/** What a layout gives each section: a colour block to sit on (colour-blocking), or a hang from column 4 (editorial). */
export interface LayoutSection {
  ground?: (typeof LAYOUT_GROUNDS)[number]
  hang?: boolean
}

/**
 * Each section's part in the layout, by its place on the page. colour-blocking puts every other section (the second,
 * the fourth…) on the next colour block in turn; a block that names its own `tone`, or that LAYOUT_SKIPS keeps on the
 * page ground, keeps its own and the turn passes to the next. editorial hangs every other section, the first never.
 */
export function layoutSections(layout: PageLayout | undefined, sections: readonly PageBlock[]): LayoutSection[] {
  if (layout === "editorial") return sections.map((_, i) => (i % 2 === 1 ? { hang: true } : {}))
  if (layout !== "colour-blocking") return sections.map(() => ({}))
  const skips = LAYOUT_SKIPS["colour-blocking"]
  let turn = 0
  return sections.map((b, i) => {
    if (i % 2 === 0 || ("tone" in b && b.tone !== undefined) || skips.includes(b.block)) return {}
    const ground = LAYOUT_GROUNDS[turn % LAYOUT_GROUNDS.length]
    turn++
    return { ground }
  })
}

/** The colour blocks of a brand that is not feather-tokens/4, as foundation.css's base layer points them. */
const BLOCK_DEFAULTS: Record<string, string> = {
  "--block-1": "var(--primary)",
  "--block-1-ink": "var(--primary-foreground)",
  "--block-2": "var(--surface-inverse)",
  "--block-2-ink": "var(--text-inverse)",
  "--block-3": "var(--accent)",
  "--block-3-ink": "var(--accent-foreground)",
  "--block-4": "var(--muted)",
  "--block-4-ink": "var(--text-primary)",
}

/** The custom properties of a compiled theme's root block (the first `:root:root { … }` buildTheme writes, or the
 * declarations alone, as schemeCss takes them). */
export function themeVars(css: string): Record<string, string> {
  const open = css.indexOf(":root:root {")
  const body = open === -1 ? css : css.slice(open + ":root:root {".length, css.indexOf("}", open))
  const vars: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) if (!(m[1] in vars)) vars[m[1]] = m[2].trim()
  return vars
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Splits a function's arguments at its top-level commas. */
function args(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === "," && depth === 0) {
      out.push(inner.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(inner.slice(start).trim())
  return out
}

/** A theme value as a hex colour: a hex, a var() of one, or an oklab color-mix of two; null for anything else. */
export function resolveColor(value: string | undefined, vars: Record<string, string>, depth = 0): string | null {
  if (value === undefined || depth > 12) return null
  const v = value.trim()
  if (HEX.test(v)) return v
  const ref = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*(.+))?\)$/i.exec(v)
  if (ref) return resolveColor(vars[ref[1]] ?? BLOCK_DEFAULTS[ref[1]] ?? ref[2], vars, depth + 1)
  const mix = /^color-mix\(\s*in oklab\s*,(.*)\)$/i.exec(v)
  if (mix) {
    const [a, b] = args(mix[1])
    const share = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(a ?? "")
    if (!share || b === undefined) return null
    const x = resolveColor(share[1], vars, depth + 1)
    const y = resolveColor(b, vars, depth + 1)
    return x && y ? oklabMix(x, y, Number(share[2])) : null
  }
  return null
}

const read = (name: string, vars: Record<string, string>) => resolveColor(vars[name] ?? BLOCK_DEFAULTS[name], vars)

/** The worst of an ink and its secondary tint (SECONDARY_INK % of it, mixed into the ground) on a ground; null when
 * either cannot be measured. */
function pairFloor(ink: string | null, ground: string | null): number | null {
  if (!ink || !ground) return null
  const a = contrastRatio(ink, ground)
  const b = contrastRatio(oklabMix(ink, ground, SECONDARY_INK), ground)
  return a === null || b === null ? null : Math.min(a, b)
}

export interface LayoutPlan {
  /** Each section's ground or hang, in order. */
  sections: LayoutSection[]
  /** The two-colour page's ink: the brand's primary where it reads, else its text colour. */
  ink?: "primary" | "text"
  /** A ground the brand's colours cannot carry, as `contradiction`s at /layout. */
  issues: PageIssue[]
}

const ratio = (n: number | null) => (n === null ? "cannot be measured" : `reads at ${n.toFixed(2)}:1`)

/**
 * The plan of a page's layout in a brand: `themes` are the compiled themes the page can show (the brand's, and the
 * scheme's other set when it has one). colour-blocking measures every colour block it uses, and two-colour its ink and
 * the inverse it makes of it, in every one of them; without a theme (the host applied its own) nothing is measured and
 * two-colour prints in the text colour, which the engine always holds to its floor.
 */
export function layoutPlan(layout: PageLayout | undefined, sections: readonly PageBlock[], themes: readonly string[] = []): LayoutPlan {
  const placed = layoutSections(layout, sections)
  const issues: PageIssue[] = []
  const sets = themes.map(themeVars)
  const fail = (message: string) => issues.push({ path: "/layout", code: "contradiction", message })
  if (layout === "colour-blocking") {
    const used = [...new Set(placed.map((s) => s.ground).filter((g): g is NonNullable<typeof g> => g !== undefined))]
    for (const [i, vars] of sets.entries())
      for (const g of used) {
        const floor = pairFloor(read(`--${g}-ink`, vars), read(`--${g}`, vars))
        if (floor === null || floor < LAYOUT_FLOOR) fail(`colour-blocking puts sections on ${g}, whose ink (or its secondary tint) ${ratio(floor)} on it${i ? " in the scheme's other set" : ""}; the floor is ${LAYOUT_FLOOR}:1. Give the brand's colors.blocks a pair that reads, or choose another layout`)
      }
    return { sections: placed, issues }
  }
  if (layout === "two-colour") {
    // The ink on the ground, and the ground on the ink (the page's inverse grounds), each with its secondary tint.
    const reads = (name: string) =>
      sets.every((vars) => {
        const ink = read(name, vars)
        const ground = read("--background", vars)
        const worst = [pairFloor(ink, ground), pairFloor(ground, ink)]
        return worst.every((n) => n !== null && n >= LAYOUT_FLOOR)
      })
    if (sets.length === 0 || reads("--primary")) return { sections: placed, ink: sets.length ? "primary" : "text", issues }
    if (reads("--text-primary")) return { sections: placed, ink: "text", issues }
    const floor = Math.min(...sets.map((vars) => pairFloor(read("--text-primary", vars), read("--background", vars)) ?? 0))
    fail(`two-colour prints in one ink on the ground, and neither the primary nor the text colour (with its secondary tint) reads at ${LAYOUT_FLOOR}:1 on it (the text ${floor.toFixed(2)}:1); choose another layout`)
    return { sections: placed, ink: "text", issues }
  }
  return { sections: placed, issues }
}
