// Drives one rendered page through every check. Used for stories (audit.spec.ts) and for fixtures (selftest.spec.ts).
import type { Page } from "@playwright/test"
import { BORDER_WIDTHS, CONTROL_HEIGHT, CONTROL_HEIGHT_SET, CONTROL_SLOTS, CURVE, DENSITIES, FOCUS, ICON_SIZES, INTERACTIVE_SELECTOR, LINE_GRID, SIZE_HEIGHT, TARGET, TYPE_SIZES, WEIGHTS } from "./expected"
import type { Density, ThemeSpec } from "./expected"
import { install } from "./inpage"
import type { Consts, Failure, InteractiveRef, StaticOpts } from "./inpage"

export interface Row extends Failure {
  story: string
  theme: string
  density: string
}

export interface Ctx {
  story: string
  theme: ThemeSpec
  densities?: readonly Density[]
  /** Milliseconds to let entry animations finish before measuring. */
  settleMs?: number
  /** Run the hover and focus passes (they are the slow part). */
  dynamic?: boolean
  controlHeight?: Record<Density, number>
}

/** Interactive elements hovered per density, and Tab stops per density. Larger stories are sampled evenly. */
export const HOVER_CAP = Number(process.env.AUDIT_HOVER_CAP ?? 24)
export const TAB_CAP = Number(process.env.AUDIT_TAB_CAP ?? 40)
export const PROGRAMMATIC_CAP = 16

const consts = (): Consts => ({
  controlSlots: CONTROL_SLOTS,
  controlHeights: CONTROL_HEIGHT_SET,
  sizeHeights: SIZE_HEIGHT,
  interactive: INTERACTIVE_SELECTOR,
  target: TARGET,
  typeSizes: TYPE_SIZES,
  weights: WEIGHTS,
  lineGrid: LINE_GRID,
  iconSizes: ICON_SIZES,
  borderWidths: BORDER_WIDTHS,
  focus: FOCUS,
  curve: CURVE,
})

function sample<T>(xs: T[], cap: number): T[] {
  if (xs.length <= cap) return xs
  const step = xs.length / cap
  return Array.from({ length: cap }, (_, i) => xs[Math.floor(i * step)])
}

/** Typed wrappers over window.__audit. */
function api(page: Page) {
  return {
    setDensity: (d: string) => page.evaluate((v) => window.__audit?.setDensity(v), d),
    settle: () => page.evaluate(() => window.__audit?.settle()),
    static: (o: StaticOpts) => page.evaluate((v) => window.__audit?.static(v) ?? [], o),
    motion: (o: StaticOpts) => page.evaluate((v) => window.__audit?.motion(v) ?? [], o),
    reduced: () => page.evaluate(() => window.__audit?.reduced() ?? []),
    interactive: () => page.evaluate(() => window.__audit?.interactive() ?? []),
    prepare: (id: number) => page.evaluate((v) => window.__audit?.prepare(v) ?? null, id),
    baseline: () => page.evaluate(() => window.__audit?.baseline()),
    compare: (rule: string, id: number | null) => page.evaluate(([r, v]) => window.__audit?.compare(r as string, v as number | null) ?? [], [rule, id] as const),
    focusCheck: () => page.evaluate(() => window.__audit?.focusCheck() ?? { end: true, failures: [] as Failure[] }),
    focusById: (id: number) => page.evaluate((v) => window.__audit?.focusById(v) ?? false, id),
    blur: () => page.evaluate(() => window.__audit?.blur()),
  }
}

export async function runAudit(page: Page, ctx: Ctx): Promise<Row[]> {
  const densities = ctx.densities ?? DENSITIES
  const heights = ctx.controlHeight ?? CONTROL_HEIGHT
  const rows: Row[] = []
  const seen = new Set<string>()
  const push = (density: string, fs: Failure[]) => {
    for (const f of fs) {
      const key = [f.rule, f.property, f.slot, f.selector, density].join("|")
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ ...f, story: ctx.story, theme: ctx.theme.name, density })
    }
  }
  const opts = (d: Density): StaticOpts => ({ density: d, expectedHeight: heights[d], radii: ctx.theme.radii, durations: ctx.theme.durations })

  await page.evaluate(install, consts())
  const a = api(page)

  // Normal motion: transition durations and curves as authored.
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.waitForTimeout(ctx.settleMs ?? 700)
  for (const d of densities) {
    await a.setDensity(d)
    await a.settle()
    push(d, await a.motion(opts(d)))
  }

  // Reduced motion: everything is at rest, so geometry is measured here, and the reduced-motion rule is checked.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.waitForTimeout(150)
  for (const d of densities) {
    await a.setDensity(d)
    await a.settle()
    push(d, await a.static(opts(d)))
    push(d, await a.reduced())
    if (ctx.dynamic ?? true) await dynamicPass(page, d, push)
  }
  return rows
}

async function dynamicPass(page: Page, density: string, push: (density: string, fs: Failure[]) => void) {
  const a = api(page)
  const settle = () => a.settle()
  const list: InteractiveRef[] = await a.interactive()

  // Hover: every box before and after.
  await a.baseline()
  for (const it of sample(list, HOVER_CAP)) {
    const pt = await a.prepare(it.id)
    if (!pt) continue
    await page.mouse.move(pt.x, pt.y)
    await settle()
    push(density, await a.compare("shift.hover", it.id))
  }
  await page.mouse.move(0, 0)
  await settle()

  // Focus: Tab through the story, then focus anything Tab did not reach.
  await a.blur()
  await a.baseline()
  for (let i = 0; i < TAB_CAP; i++) {
    await page.keyboard.press("Tab")
    await settle()
    const r = await a.focusCheck()
    if (r.end) break
    push(density, r.failures)
    push(density, await a.compare("shift.focus", null))
  }
  let extra = 0
  for (const it of list) {
    if (extra >= PROGRAMMATIC_CAP) break
    if (!(await a.focusById(it.id))) continue
    extra++
    await settle()
    const r = await a.focusCheck()
    push(density, r.failures)
    push(density, await a.compare("shift.focus", null))
  }
  await a.blur()
}
