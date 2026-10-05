// PlanView: renders a layout plan on the web, and turns every act into a checked reply.
import * as React from "react"
import { validateReply, type Experience, type ReplyEvent, type ReplyIssue } from "@aleeforoughi/feather-intent"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { Button, Card, CardContent, MotionPreference } from "@aleeforoughi/feather-react"
import { DENSITY } from "@aleeforoughi/feather-tokens"
import { directionOf, OTHER_OPTIONS_LABEL } from "@aleeforoughi/feather-dialog"
import { NodeView } from "./nodes"
import { experienceCurrency, experienceOf, firstControl, nodeIndex } from "./plan-utils"
import { RenderingContext, type Emit, type Rendering } from "./rendering"
import { useLifecycle } from "./lifecycle"
import { ExperienceResolution } from "./resolution"
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
 * The collapsed secondary nodes, behind one disclosure after the rest of the region. Closed at first render, and its
 * contents are not rendered until it is opened, so nothing inside is focusable or scanned. Opening emits no reply, and
 * once open it stays open (docs/composer.md, "Rendering on the web").
 */
function OtherOptions({ nodes, keyOf }: { nodes: PlanNode[]; keyOf: (node: PlanNode) => string }) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  return (
    <div data-slot="experience-other" data-variant={open ? "open" : "closed"} className="flex flex-col gap-4">
      <Button type="button" variant="outline" data-slot="experience-other-options" aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)} className="self-start">
        {OTHER_OPTIONS_LABEL}
      </Button>
      {open && (
        <div id={id} data-slot="experience-other-content" className="flex flex-col gap-4">
          {nodes.map((node) => (
            <NodeView key={keyOf(node)} node={node} />
          ))}
        </div>
      )}
    </div>
  )
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
  const root = React.useRef<HTMLDivElement | null>(null)
  const [host, setHost] = React.useState<HTMLDivElement | null>(null)
  const rootRef = React.useCallback((el: HTMLDivElement | null) => {
    root.current = el
    setHost(el)
  }, [])
  const { keyOf, message, summaryRef, rootProps } = useLifecycle(plan, root, host)
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
  // A collapsed experience shows its resolution and nothing else, whatever the body: one line, no card, no controls.
  const collapsed = plan.lifecycle === "collapsed"
  const content = collapsed ? (
    plan.resolution && <ExperienceResolution ref={summaryRef} resolution={plan.resolution} />
  ) : spoken ? (
    <PlainSummary plan={plan} />
  ) : (
    <div data-slot="experience-regions" className="flex flex-col gap-4">
      {plan.regions.map((region) => {
        if (region.nodes.length === 0) return null
        const secondary = region.id === "secondary"
        const shown = region.nodes.filter((node) => node.collapsed !== true)
        const folded = region.nodes.filter((node) => node.collapsed === true)
        return (
          <div key={region.id} data-slot="experience-region" data-variant={region.id} role={secondary ? "group" : undefined} aria-label={secondary ? "Other ways to go" : undefined} className="flex flex-col gap-4">
            {shown.map((node: PlanNode) => (
              <NodeView key={keyOf(node)} node={node} />
            ))}
            {secondary && folded.length > 0 && <OtherOptions nodes={folded} keyOf={keyOf} />}
          </div>
        )
      })}
    </div>
  )

  const classes = ["text-fg-primary outline-none", className ?? ""].filter(Boolean).join(" ")
  return (
    <MotionPreference.Provider value={plan.motion}>
      <RenderingContext.Provider value={rendering}>
        <div
          ref={rootRef}
          // Focusable by script only: it takes focus when the element that had it is removed by an update.
          tabIndex={-1}
          {...rootProps}
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
          <div data-slot="experience-updates" aria-live="polite" aria-atomic="true" className="sr-only">
            {message}
          </div>
          {plan.chrome === "card" && !collapsed ? (
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
