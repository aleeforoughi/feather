import * as React from "react"
import { fitChars, fitParts, isLongRun } from "../core/fit"

/** The inline style that tells foundation.css a text's longest run (--fit-chars), or undefined when every run is
 * within the measure, so ordinary text writes no style at all. */
export function fitStyle(...texts: string[]): React.CSSProperties | undefined {
  const n = fitChars(...texts)
  return n === undefined ? undefined : ({ "--fit-chars": n } as React.CSSProperties)
}

/**
 * FitText: a title's text with each run longer than the measure (core/fit) set as one unbreakable piece, `fit-word`:
 * it never breaks at a line's end while it fits, and hyphenates (hyphens: auto, in the page's lang) only when it
 * cannot fit even at the floor. A text with no long run is returned as the plain string, so it renders exactly as
 * before. Use it inside an element that sets `fitStyle(text)`.
 */
export function FitText({ children }: { children: string }): React.ReactNode {
  const parts = fitParts(children)
  if (!parts.some(isLongRun)) return children
  return parts.map((part, i) =>
    isLongRun(part) ? (
      <span key={i} data-slot="fit-word" className="fit-word">
        {part}
      </span>
    ) : (
      part
    )
  )
}
