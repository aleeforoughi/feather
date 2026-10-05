// A collapsed experience (docs/lifecycle.md section 2.5): one line, in words. The outcome, what happened, and what it left
// behind. No card and no controls: the work is done, and what stays is a sentence and, perhaps, a link.
import * as React from "react"
import type { Resolution } from "@aleeforoughi/feather-intent"
import { httpUrl } from "@aleeforoughi/feather-dialog"

const OUTCOME_WORD: Record<Resolution["outcome"], string> = { done: "Done", cancelled: "Cancelled", failed: "Failed" }

/**
 * The resolution as a `role="status"` line. The summary is focusable by script (`tabIndex` -1), so a person who had focus
 * inside the experience when it collapsed lands on what happened rather than on the page.
 */
export const ExperienceResolution = React.forwardRef<HTMLSpanElement, { resolution: Resolution }>(function ExperienceResolution({ resolution }, summaryRef) {
  const { outcome, summary, artifact } = resolution
  const href = artifact?.href === undefined ? undefined : httpUrl(artifact.href)
  return (
    <p role="status" data-slot="experience-resolution" data-variant={outcome} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 type-body text-fg-primary">
      <span data-slot="experience-resolution-outcome" className="type-label text-fg-secondary">
        {OUTCOME_WORD[outcome]}
      </span>
      <span ref={summaryRef} tabIndex={-1} data-slot="experience-resolution-summary" className="break-words outline-none">
        {summary}
      </span>
      {artifact &&
        (href ? (
          <a data-slot="experience-resolution-artifact" data-variant="link" href={href} target="_blank" rel="noreferrer noopener" className="hit-area inline-flex min-h-6 items-center rounded-xs type-label text-fg-primary underline underline-offset-4">
            {artifact.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span data-slot="experience-resolution-artifact" data-variant="text" className="type-label text-fg-secondary">
            {artifact.label}
          </span>
        ))}
    </p>
  )
})
