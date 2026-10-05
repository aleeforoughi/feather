// FeatherExperience: an Experience IR and the context it is rendered in, composed and rendered.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience, Issue, ReplyEvent, ReplyIssue } from "@aleeforoughi/feather-intent"
import { compose, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { PlanView } from "./plan-view"

export interface FeatherExperienceProps {
  /** The Experience IR (`feather.ir/1`), as the caller sent it. It is validated; it need not be trusted. */
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

/** The plan to show, and the experience it was composed from. */
export interface ShownPlan {
  plan: LayoutPlan
  experience: Experience
}

/**
 * Composes `experience` for `context` and returns what to show, reporting an invalid IR to `onIssues`. A plan whose
 * revision is lower than the one shown keeps what is shown (docs/lifecycle.md section 2.6): the caller's updates are in
 * order, so a lower revision is stale. The same revision replaces it: the caller re-sent it, or the context changed.
 * Returns `null` while the IR is invalid.
 */
export function useShownPlan(experience: unknown, context: RenderContext, onIssues?: (issues: Issue[]) => void): ShownPlan | null {
  const result = React.useMemo(() => compose(experience, context), [experience, context])
  // The callback may change on every render of the host; only a new result is worth reporting.
  const report = React.useRef(onIssues)
  React.useEffect(() => {
    report.current = onIssues
  })
  React.useEffect(() => {
    if (!result.ok) report.current?.(result.issues)
  }, [result])
  // What is shown is state derived while rendering: a plan that is not newer is simply not taken.
  const [shown, setShown] = React.useState<(ShownPlan & { context: RenderContext }) | undefined>(undefined)
  if (!result.ok) return null
  const stale = shown !== undefined && shown.plan.experience === result.plan.experience && result.plan.revision < shown.plan.revision
  if (stale) return shown
  if (shown?.plan !== result.plan || shown.experience !== experience || shown.context !== context) setShown({ plan: result.plan, experience: experience as Experience, context })
  return { plan: result.plan, experience: experience as Experience }
}

/**
 * Composes `experience` for `context` and renders the plan on the web. An invalid IR renders nothing and is reported
 * to `onIssues`: the composer refuses it, and a broken page is never drawn. When the caller updates the experience, hand the
 * new one to the same component: it changes in place (docs/lifecycle.md section 2).
 */
export function FeatherExperience({ experience, context, onReply, onIssues, onRejectedReply, autoFocus, className }: FeatherExperienceProps) {
  const shown = useShownPlan(experience, context, onIssues)
  if (!shown) return null
  return <PlanView plan={shown.plan} experience={shown.experience} onReply={onReply} onRejectedReply={onRejectedReply} autoFocus={autoFocus} className={className} />
}
