// The values Gate 2 enforces, from docs/visual-system.md (sections 2 to 10), in one place.
// When the theme engine exports RADIUS_TIERS, DENSITIES, DURATIONS, ELEVATION or CONTRAST_FLOORS, `fromEngine()`
// reads them and the audit uses the engine's numbers; `source` in the report says which one won.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, "../../..")

/** The three semantic densities, in the order they are audited. */
export const DENSITIES = ["tight", "default", "spacious"] as const
export type Density = (typeof DENSITIES)[number]

/** Control height per density (section 3). */
export const CONTROL_HEIGHT: Record<Density, number> = { tight: 36, default: 44, spacious: 52 }
export const CONTROL_HEIGHT_SET = [36, 44, 52]

/** `data-size` values that pin a height regardless of density (section 3). `default` (or no attribute) follows the density. */
// Pinned sizes only: `default` and `icon` follow the surrounding density (visual-system.md section 3).
export const SIZE_HEIGHT: Record<string, number> = { xs: 36, sm: 36, lg: 52, "icon-xs": 36, "icon-sm": 36, "icon-lg": 52 }

/**
 * The data-slot names of the control frame (section 3): buttons, fields, triggers and the organisms' action buttons.
 * Found by grepping packages/react/src/components/ui. Keep this the only list. A native button, select or text input
 * with no data-slot at all is also treated as a control frame, so omitting the slot cannot dodge the audit.
 */
export const CONTROL_SLOTS = [
  "button",
  "input",
  "select-trigger",
  "combobox-input",
  "toggle",
  "toggle-group-item",
  "tabs-trigger",
  "dialog-close",
  "sheet-close",
  "approval-cancel",
  "approval-confirm",
  "recommendation-accept",
  "recommendation-cancel",
  "recommendation-confirm",
  "predicted-choice-action",
  "irreversible-action-arm",
  "irreversible-action-cancel",
  "irreversible-action-confirm",
  "correction-input-field",
  "correction-input-submit",
  "alternative-list-button",
  "alternative-list-input",
  "explore-more-button",
]

/** Interactive elements whose hit area must reach 44 x 44 (section 3, Targets). */
export const INTERACTIVE_SELECTOR =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], summary'
export const TARGET = 44

export const TYPE_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64]
export const WEIGHTS = [400, 500, 600, 700]
export const LINE_GRID = 4
export const ICON_SIZES = [16, 20, 24, 32]
export const BORDER_WIDTHS = [0, 1]
export const FOCUS = { width: 2, offset: 2 }
export const CURVE = "cubic-bezier(0.4, 0, 0.2, 1)"

/** Radius values by brand shape (section 7): xs, the control base, and the card and dialog tiers plus one step per
 * level of rounded surface nested inside them (up to two). 0 and "full" are always allowed. */
export const RADIUS_TIERS: Record<string, number[]> = {
  sharp: [0],
  soft: [0, 4, 8, 12, 16, 20],
  rounded: [0, 4, 8, 12, 16, 20, 24],
  pill: [0, 4, 16, 20, 24, 28],
}
/** The radius step per brand shape: a surface is at least one step larger than a rounded surface inside it. */
export const RADIUS_STEP: Record<string, number> = { sharp: 0, soft: 4, rounded: 4, pill: 4 }

/** The six durations per brand motion axis, in ms (section 10). */
export const DURATIONS: Record<string, number[]> = {
  calm: [100, 140, 180, 240, 320, 420],
  snappy: [80, 100, 140, 180, 240, 320],
}

export interface ThemeSpec {
  name: string
  shape: string
  motion: string
  radii: number[]
  /** One step of the radius hierarchy: a surface is at least this much larger than a surface it holds. */
  step: number
  durations: number[]
}

export interface Expected {
  source: "spec" | "engine"
  controlHeight: Record<Density, number>
  radiusTiers: Record<string, number[]>
  durations: Record<string, number[]>
  notes: string[]
}

const toPx = (v: unknown): number | null => {
  if (typeof v === "number") return v
  if (typeof v !== "string") return null
  const m = /^(-?[\d.]+)(px|rem|ms|s)?$/.exec(v.trim())
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2] === "rem" ? n * 16 : m[2] === "s" ? n * 1000 : n
}

const numbers = (o: unknown): number[] | null => {
  if (Array.isArray(o)) {
    const xs = o.map(toPx)
    return xs.every((x) => x !== null) ? (xs as number[]) : null
  }
  if (o && typeof o === "object") {
    const xs = Object.values(o).map(toPx)
    return xs.every((x) => x !== null) ? (xs as number[]) : null
  }
  return null
}

/** Reads the engine's V1 exports when present. Anything it cannot parse falls back to the spec values above. */
export async function fromEngine(): Promise<Expected> {
  const spec: Expected = { source: "spec", controlHeight: CONTROL_HEIGHT, radiusTiers: RADIUS_TIERS, durations: DURATIONS, notes: [] }
  let engine: Record<string, unknown>
  try {
    engine = (await import("@aleeforoughi/feather-tokens")) as Record<string, unknown>
  } catch (e) {
    spec.notes.push(`engine import failed: ${String(e)}`)
    return spec
  }
  const out: Expected = { ...spec, radiusTiers: { ...RADIUS_TIERS }, durations: { ...DURATIONS }, controlHeight: { ...CONTROL_HEIGHT } }
  let used = false
  const tiers = engine.RADIUS_TIERS as Record<string, unknown> | undefined
  if (tiers && typeof tiers === "object") {
    for (const [shape, v] of Object.entries(tiers)) {
      const xs = numbers(v)?.filter((n) => n < 9999)
      if (xs) {
        // The engine's tiers are { xs, control, card, dialog, step }: card and dialog grow by one step per nesting level.
        const t = v as Record<string, string>
        const step = numbers({ s: t.step })?.[0]
        const grown = step !== undefined && t.card && t.dialog ? [0, 1, 2].flatMap((k) => [...(numbers({ a: t.card }) ?? []), ...(numbers({ b: t.dialog }) ?? [])].map((r) => r + k * step)) : []
        const base = (numbers({ x: t.xs, c: t.control }) ?? []).filter((n) => n < 9999)
        out.radiusTiers[shape] = [...new Set([0, ...(t.step !== undefined ? [...base, ...grown] : xs)])].sort((a, b) => a - b)
        used = true
      } else out.notes.push(`RADIUS_TIERS.${shape} not parseable; spec values kept`)
    }
  }
  const durs = engine.DURATIONS as Record<string, unknown> | undefined
  if (durs && typeof durs === "object") {
    for (const [motion, v] of Object.entries(durs)) {
      const xs = numbers(v)
      if (xs) {
        out.durations[motion] = xs
        used = true
      } else out.notes.push(`DURATIONS.${motion} not parseable; spec values kept`)
    }
  }
  const dens = engine.DENSITIES as Record<string, unknown> | undefined
  if (dens && typeof dens === "object") {
    const alias: Record<string, Density> = { compact: "tight", tight: "tight", comfortable: "default", default: "default", spacious: "spacious" }
    for (const [name, v] of Object.entries(dens)) {
      const key = alias[name]
      const rec = v as Record<string, unknown> | null
      const h = rec && typeof rec === "object" ? toPx(rec["--control-height"] ?? rec.controlHeight ?? rec.control ?? rec.height ?? rec["control-height"]) : toPx(v)
      if (key && h) {
        out.controlHeight[key] = h
        used = true
      }
    }
  }
  out.source = used ? "engine" : "spec"
  for (const d of DENSITIES) if (out.controlHeight[d] !== CONTROL_HEIGHT[d]) out.notes.push(`engine ${d} height ${out.controlHeight[d]} differs from the spec ${CONTROL_HEIGHT[d]}`)
  return out
}

/** The reference themes (packages/tokens/themes) with their tier set and durations resolved. */
export function loadThemes(expected: Expected): ThemeSpec[] {
  const dir = path.join(REPO, "packages/tokens/themes")
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { name: string; tokens: { shape?: string; motion?: string } }
      const shape = json.tokens.shape ?? "rounded"
      const motion = json.tokens.motion ?? "calm"
      return { name: json.name, shape, motion, radii: expected.radiusTiers[shape] ?? RADIUS_TIERS.rounded, step: RADIUS_STEP[shape] ?? 4, durations: expected.durations[motion] ?? DURATIONS.calm }
    })
}

/** Rule ids, grouped for the summary. */
export const RULES: Record<string, string> = {
  "controls.height": "control height is 36/44/52 and matches the density or size",
  "controls.square": "icon-only control is square",
  "controls.row": "controls in one row share a height",
  "targets.size": "hit area reaches 44 x 44",
  "borders.width": "border width is 0 or 1px",
  "focus.ring": "focus outline is 2px, offset 2px (or an equivalent 2px ring)",
  "shift.hover": "hover changes no box",
  "shift.focus": "focus changes no box",
  "type.size": "font-size is on the scale",
  "type.weight": "font-weight is 400/500/600/700",
  "type.line-height": "line-height is a multiple of 4px",
  "radius.tier": "border-radius is in the theme's tier set",
  "radius.nesting": "flush child radius is at most its parent's",
  "icons.size": "icon box is 16/20/24/32",
  "pixels.whole": "borders, icons and control frames sit on whole pixels",
  "motion.all": "no transition-property all on a running transition",
  "motion.curve": "non-zero transitions use the standard curve",
  "motion.duration": "non-zero transitions use one of the theme's six durations",
  "motion.reduced": "reduced motion takes every duration to 0.01ms",
  "harness.render": "the story rendered",
}
