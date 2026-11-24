// Where a turn goes, and whether the page follows it (Qooler file 23 §6). Pure functions over measured boxes, so the
// rules are tested without a browser.

export interface Box {
  id: string
  top: number
  bottom: number
}

/** The section the reader is in: the one that holds the reading line (40% down the viewport), else the most visible.
 * A turn is inserted right after it, so it opens where the reader is. Returns null when nothing is measured. */
export function sectionInView(sections: Box[], viewport: { top: number; height: number }): string | null {
  if (sections.length === 0) return null
  const line = viewport.top + viewport.height * 0.4
  const holding = sections.find((s) => s.top <= line && s.bottom > line)
  if (holding) return holding.id
  const visible = (s: Box) => Math.max(0, Math.min(s.bottom, viewport.top + viewport.height) - Math.max(s.top, viewport.top))
  const best = [...sections].sort((a, b) => visible(b) - visible(a) || a.top - b.top)[0]
  return visible(best) > 0 ? best.id : sections.filter((s) => s.top <= viewport.top).at(-1)?.id ?? sections[0].id
}

/** How close to the bottom (px) still counts as "at the bottom". */
export const FOLLOW_SLACK = 48

export interface ScrollState {
  scrollTop: number
  viewportHeight: number
  /** The bottom edge of the growing answer, in the same coordinates as scrollTop. */
  contentBottom: number
}

/** Whether the reader is at the bottom of the growing answer. */
export const atBottom = (s: ScrollState) => s.contentBottom - (s.scrollTop + s.viewportHeight) <= FOLLOW_SLACK

/**
 * The follow rule: while the answer grows, the page follows only if the reader is at its bottom; once they scroll up,
 * it stops. Jump-to-latest shows whenever they are away from the bottom of the latest answer.
 */
export function followDecision(s: ScrollState, growing: boolean): { follow: boolean; showJump: boolean } {
  const bottom = atBottom(s)
  return { follow: growing && bottom, showJump: !bottom }
}

/**
 * Where the page scrolls when a turn opens: the visitor's question anchors at the top of the view (below a fixed
 * header of `offset` px) while the answer grows beneath it. Never moves the page backwards past what the reader has
 * read unless the turn is above them.
 */
export function anchorScroll(turnTop: number, offset = 0): number {
  return Math.max(0, Math.round(turnTop - offset))
}
