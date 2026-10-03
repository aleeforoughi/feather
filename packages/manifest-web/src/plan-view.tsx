// PlanView: renders a layout plan on the web, and turns every act into a checked reply.
import * as React from "react"
import { validateReply, type Experience, type ReplyEvent, type ReplyIssue } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { Card, CardContent, MotionPreference } from "@aleeforoughi/feather-react"
import { DENSITY } from "@aleeforoughi/feather-tokens"
import { directionOf } from "@aleeforoughi/feather-dialog"
import { NodeView } from "./nodes"
import { experienceCurrency, experienceOf, firstControl, nodeIndex } from "./plan-utils"
import { RenderingContext, type Emit, type Rendering } from "./rendering"
import { PlainSummary } from "./summary"

export interface PlanViewProps {
  plan: LayoutPlan
  /** Receives every reply, after `validateReply` has accepted it. */
  onReply: (reply: ReplyEvent) => void
  /**
   * The experience the plan was composed from. Replies are checked against it. Optional: without it, the experience
   * is rebuilt from the IR nodes the plan carries.
   */
  experience?: Experience
  /** Called with why a reply was refused. A refused reply is never passed to `onReply`. */
  onRejectedReply?: (issues: ReplyIssue[], reply: unknown) => void
  /**
   * Whether focus moves to `plan.focus` when the view first mounts (default true). It never moves at any other time.
   * An editor that remounts the view as a person types turns it off, so typing is not interrupted.
   */
  autoFocus?: boolean
  className?: string
}

/**
 * Renders a plan: the regions in order (main, then secondary), each node in a wrapper with `data-feather-node`,
 * `data-organism` and `data-emphasis`. The plan's chrome, density, motion, contrast, expansion,
 * confirmation, preselection and focus are applied; the renderer never re-decides. The plan's minimum target is written
 * as `data-min-target` only: every component reaches 44 x 44px through `hit-area` (docs/visual-system.md section 3), so
 * the renderer adds no target classes of its own.
 *
 * A voice or text plan has no screen to draw on, so it renders a plain, accessible summary instead.
 */
export function PlanView({ plan, onReply, experience, onRejectedReply, autoFocus = true, className }: PlanViewProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const checked = React.useMemo(() => experience ?? experienceOf(plan), [experience, plan])
  const emit = React.useCallback<Emit>(
    (node, act, value) => {
      const reply: Record<string, unknown> = { experience: plan.experience, node, act }
      if (value !== undefined) reply.value = value
      const result = validateReply(checked, reply)
      if (!result.ok) {
        onRejectedReply?.(result.issues, reply)
        return { ok: false, message: result.issues[0]?.message ?? "The reply was not accepted." }
      }
      onReply(result.reply)
      return { ok: true }
    },
    [checked, onReply, onRejectedReply, plan.experience],
  )
  const rendering = React.useMemo<Rendering>(() => {
    const nodes = nodeIndex(plan)
    return { plan, emit, nodes, currency: experienceCurrency(nodes.values()) }
  }, [plan, emit])

  // Focus starts on the plan's node, once, when the view mounts; a later plan or render never moves it.
  React.useEffect(() => {
    if (!autoFocus || plan.focus === null || plan.manifestation === "voice" || plan.manifestation === "text") return
    const host = Array.from(root.current?.querySelectorAll("[data-feather-node]") ?? []).find((el) => el.getAttribute("data-feather-node") === plan.focus)
    if (host) firstControl(host)?.focus()
    // Mount only, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spoken = plan.manifestation === "voice" || plan.manifestation === "text"
  const content = spoken ? (
    <PlainSummary plan={plan} />
  ) : (
    <div data-slot="experience-regions" className="flex flex-col gap-4">
      {plan.regions.map((region) =>
        region.nodes.length === 0 ? null : (
          <div key={region.id} data-slot="experience-region" data-variant={region.id} role={region.id === "secondary" ? "group" : undefined} aria-label={region.id === "secondary" ? "Other ways to go" : undefined} className="flex flex-col gap-4">
            {region.nodes.map((node: PlanNode) => (
              <NodeView key={node.id} node={node} />
            ))}
          </div>
        ),
      )}
    </div>
  )

  const classes = ["text-fg-primary", className ?? ""].filter(Boolean).join(" ")
  return (
    <MotionPreference.Provider value={plan.motion}>
      <RenderingContext.Provider value={rendering}>
        <div
          ref={root}
          data-slot="experience"
          data-variant={plan.manifestation}
          data-feather-experience={plan.experience}
          data-manifestation={plan.manifestation}
          data-chrome={plan.chrome}
          data-density={DENSITY[plan.density]}
          data-min-target={plan.minTarget}
          data-motion={plan.motion}
          data-contrast={plan.contrast}
          data-cues={plan.cues}
          lang={plan.locale}
          dir={directionOf(plan.locale)}
          className={classes}
        >
          {plan.chrome === "card" ? (
            <Card data-slot="experience-card">
              <CardContent>{content}</CardContent>
            </Card>
          ) : (
            content
          )}
        </div>
      </RenderingContext.Provider>
    </MotionPreference.Provider>
  )
}
