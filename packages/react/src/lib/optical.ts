// The optical registry (docs/visual-system.md section 9).
//
// An icon sits in a pixel-aligned square slot. The glyph inside it may be calibrated so it looks, not only measures,
// centered and equal in size. A correction is { scale, dx, dy }, and it is small on purpose:
//   - scale 0.94 to 1.06;
//   - dx and dy at most 1px at the rendered size (applied inside the SVG, never as a fractional CSS position).
// A correction beyond the budget means the source glyph needs fixing, not the registry.
//
// Values are in the lucide 24-unit grid, which is 1 unit = 1px at the 24px slot. They scale with the slot (a 16px slot
// moves two thirds as far), so one entry serves every size, and `opticalFor` clamps them to the budget at the size.

export interface Optical {
  /** Glyph scale about the slot center. */
  scale: number
  /** Horizontal shift, positive to the right. */
  dx: number
  /** Vertical shift, positive down. */
  dy: number
}

export const OPTICAL_BUDGET = { minScale: 0.94, maxScale: 1.06, maxShift: 1 } as const

/** Lucide icon name (kebab-case) to its correction. Each entry says why. Add one when review finds a glyph that needs it. */
export const OPTICAL: Readonly<Record<string, Optical>> = {
  // A right-pointing triangle: its mass sits at the base, left of the bounding box, and its area is far smaller than a
  // circle's in the same box. Nudge toward the tip and grow it a little.
  play: { scale: 1.04, dx: 0.5, dy: 0 },
  // An upward triangle: the mass sits low (the centroid is a third up from the base), and it reads smaller than the
  // square and circle icons beside it. Lift it half a pixel and grow it a little.
  triangle: { scale: 1.04, dx: 0, dy: -0.5 },
  "triangle-alert": { scale: 1.04, dx: 0, dy: -0.5 },
  // Single chevrons: the stroke ends are open and the tip is a heavier join, so a chevron looks as if it sits back from
  // the center of its box. Shift half a pixel toward the tip, the way Octicons and Material place theirs.
  "chevron-right": { scale: 1, dx: 0.5, dy: 0 },
  "chevron-left": { scale: 1, dx: -0.5, dy: 0 },
  "chevron-down": { scale: 1, dx: 0, dy: 0.5 },
  "chevron-up": { scale: 1, dx: 0, dy: -0.5 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** "TriangleAlert" (a lucide component's displayName) to "triangle-alert". */
export function iconName(displayName: string | undefined): string | undefined {
  return displayName?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Za-z])(\d)/g, "$1-$2").toLowerCase()
}

/** Whether a correction is inside the optical budget at a rendered size (px). */
export function withinBudget(optical: Optical, size: number): boolean {
  const { minScale, maxScale, maxShift } = OPTICAL_BUDGET
  const shift = (n: number) => Math.abs((n * size) / 24) <= maxShift + 1e-9
  return optical.scale >= minScale && optical.scale <= maxScale && shift(optical.dx) && shift(optical.dy)
}

/** The correction for an icon at a size, clamped to the budget. No entry means no correction. */
export function opticalFor(name: string | undefined, size: number): Optical {
  const entry = name ? OPTICAL[name] : undefined
  if (!entry) return { scale: 1, dx: 0, dy: 0 }
  // The registry is in units of the 24px grid; at `size` px a unit is size / 24 px, and the shift may not pass 1px.
  const unitsPerBudget = (OPTICAL_BUDGET.maxShift * 24) / size
  return {
    scale: clamp(entry.scale, OPTICAL_BUDGET.minScale, OPTICAL_BUDGET.maxScale),
    dx: clamp(entry.dx, -unitsPerBudget, unitsPerBudget),
    dy: clamp(entry.dy, -unitsPerBudget, unitsPerBudget),
  }
}

const trim = (n: number) => String(Number(n.toFixed(4)))

/**
 * The SVG viewBox that applies a correction. Changing the viewBox is an SVG transform of the glyph inside an element whose
 * box never changes, so the slot stays pixel-aligned: scale s shows 24 / s units, and a shift of (dx, dy) units moves the
 * view the opposite way.
 */
export function opticalViewBox({ scale, dx, dy }: Optical): string {
  const side = 24 / scale
  return `${trim(12 - side / 2 - dx * (side / 24))} ${trim(12 - side / 2 - dy * (side / 24))} ${trim(side)} ${trim(side)}`
}
