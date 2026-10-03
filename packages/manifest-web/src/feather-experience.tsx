// FeatherExperience: an Experience IR and the context it is rendered in, composed and rendered.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience, Issue, ReplyEvent, ReplyIssue } from "@aleeforoughi/feather-intent"
import { compose } from "@aleeforoughi/feather-liquid"
import { PlanView } from "./plan-view"

export interface FeatherExperienceProps {
  /** The Experience IR (`feather.ir/0`), as the caller sent it. It is validated; it need not be trusted. */
  experience: unknown
  /** Who it is rendered for, and where. The host passes it per render; nothing is stored. */
  context: RenderContext
  /** Receives every reply the person gives, checked with `validateReply`. */
  onReply: (reply: ReplyEvent) => void
  /** Called with the validator's issues when the IR is invalid; the component then renders nothing. */
  onIssues?: (issues: Issue[]) => void
  /** Called with why a reply was refused (it is then not passed to `onReply`). */
  onRejectedReply?: (issues: ReplyIssue[], reply: unknown) => void
  /** Whether focus moves to the plan's focus node on mount (default true). */
  autoFocus?: boolean
  className?: string
}

/**
 * Composes `experience` for `context` and renders the plan on the web. An invalid IR renders nothing and is reported
 * to `onIssues`: the composer refuses it, and a broken page is never drawn.
 */
export function FeatherExperience({ experience, context, onReply, onIssues, onRejectedReply, autoFocus, className }: FeatherExperienceProps) {
  const result = React.useMemo(() => compose(experience, context), [experience, context])
  // The callback may change on every render of the host; only a new result is worth reporting.
  const report = React.useRef(onIssues)
  React.useEffect(() => {
    report.current = onIssues
  })
  React.useEffect(() => {
    if (!result.ok) report.current?.(result.issues)
  }, [result])
  if (!result.ok) return null
  return <PlanView plan={result.plan} experience={experience as Experience} onReply={onReply} onRejectedReply={onRejectedReply} autoFocus={autoFocus} className={className} />
}
