// The web body's side of the lifecycle (docs/lifecycle.md section 2): an experience that changes in place. The person keeps
// their place (organisms stay mounted), nothing moves their focus, an armed act whose node changed is disarmed and said so,
// and what is new is told once, politely.
import * as React from "react"
import type { LayoutPlan, PlanNode } from "@aleeforoughi/feather-liquid"
import { newActsSentence, planNodes } from "@aleeforoughi/feather-dialog"

const NONE: ReadonlySet<string> = new Set()

/** The ids of the nodes whose act is armed right now. An armed organism marks itself `data-variant="armed"`. */
function armedIds(root: HTMLElement): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const el of root.querySelectorAll('[data-variant="armed"]')) {
    const id = el.closest("[data-feather-node]")?.getAttribute("data-feather-node")
    if (id) ids.add(id)
  }
  return ids.size === 0 ? NONE : ids
}

/** The node as it is, for telling whether an update changed it: its IR and what is attached or merged into it. */
function content(node: PlanNode): string {
  return JSON.stringify([node.node, node.attached?.map((a) => a.node), node.merged?.map((m) => m.node), node.items?.map((i) => i.node), node.confirm])
}

const intentOf = (node: PlanNode | undefined) => (node?.node && "intent" in node.node && typeof node.node.intent === "string" ? node.node.intent : (node?.id ?? ""))

interface Track {
  plan: LayoutPlan
  /** Per node id: what it looked like, and how many times an armed act on it was reset. */
  generations: ReadonlyMap<string, { hash: string; gen: number }>
  /** Armed acts whose node changed with this plan (they are remounted, which disarms them). */
  disarmed: ReadonlySet<string>
  /** Armed acts whose node this plan no longer has. */
  gone: ReadonlySet<string>
}

/** What the plan does to the generations: pure, from the last track and the acts armed in the DOM it replaces. */
function advance(last: Track | undefined, plan: LayoutPlan, armed: ReadonlySet<string>): Track {
  const generations = new Map<string, { hash: string; gen: number }>()
  const disarmed = new Set<string>()
  const nodes = new Map(planNodes(plan).map((n) => [n.id, n]))
  for (const [id, node] of nodes) {
    const hash = content(node)
    const before = last?.generations.get(id)
    if (!before) generations.set(id, { hash, gen: 0 })
    else if (before.hash === hash) generations.set(id, before)
    else if (armed.has(id)) {
      generations.set(id, { hash, gen: before.gen + 1 })
      disarmed.add(id)
    } else generations.set(id, { hash, gen: before.gen })
  }
  const gone = new Set([...armed].filter((id) => !nodes.has(id)))
  return { plan, generations, disarmed: disarmed.size === 0 ? NONE : disarmed, gone: gone.size === 0 ? NONE : gone }
}

export interface Lifecycle {
  /**
   * The React key of a plan node. It is stable by id, so a node an update leaves alone keeps its state. It changes when the
   * node's type changes (a node of another type starts over), and when the content of a node whose act is armed changes: the
   * organism is then remounted, which disarms it.
   */
  keyOf: (node: PlanNode) => string
  /** What the polite live region says now. */
  message: string
  /** The collapsed summary, which takes focus when the experience collapses with focus inside it. */
  summaryRef: React.RefObject<HTMLSpanElement | null>
  /** Handlers for the root element, which tell where focus is. */
  rootProps: { onFocus: React.FocusEventHandler<HTMLElement>; onBlur: React.FocusEventHandler<HTMLElement> }
}

/**
 * Tracks the plan across revisions. `root` is the experience's root element (and `host` the same element as state, so a render
 * can read it), which takes focus when the focused element is removed; on a collapse, focus moves to the summary instead.
 */
export function useLifecycle(plan: LayoutPlan, root: React.RefObject<HTMLElement | null>, host: HTMLElement | null): Lifecycle {
  const summaryRef = React.useRef<HTMLSpanElement>(null)
  const lastFocused = React.useRef<HTMLElement | null>(null)
  const previous = React.useRef<LayoutPlan | undefined>(undefined)
  const [message, setMessage] = React.useState("")

  // The track moves with the plan (state derived while rendering, so the keys of this render are already the new ones). The
  // acts that are armed are read from the DOM this plan is about to replace: nothing else knows, since an organism holds it.
  const [stored, setStored] = React.useState<Track | undefined>(undefined)
  const track = stored?.plan === plan ? stored : advance(stored, plan, host ? armedIds(host) : NONE)
  if (stored?.plan !== plan) setStored(track)

  React.useLayoutEffect(() => {
    const before = previous.current
    previous.current = plan
    if (!before || before === plan) return

    // Focus never moves on an update, unless the element that had it is gone (or the experience has collapsed).
    const had = lastFocused.current
    if (had && !had.isConnected && root.current) {
      if (plan.lifecycle === "collapsed" && summaryRef.current) summaryRef.current.focus()
      else if (!root.current.contains(document.activeElement)) root.current.focus()
    }

    if (plan.revision <= before.revision) return
    const was = new Map(planNodes(before).map((n) => [n.id, n]))
    const told: string[] = []
    const added = newActsSentence(before, plan)
    if (added) told.push(added)
    for (const id of track.disarmed) told.push(`${intentOf(was.get(id))} changed. It was not confirmed; read it again before you confirm.`)
    for (const id of track.gone) told.push(`${intentOf(was.get(id))} is no longer there. It was not confirmed.`)
    setMessage(told.join(" "))
  }, [plan, track, root])

  const keyOf = (node: PlanNode): string => `${node.id}:${node.type}:${track.generations.get(node.id)?.gen ?? 0}`
  const rootProps = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      lastFocused.current = e.target
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const from = e.target
      const to = e.relatedTarget
      if (to instanceof Node) {
        if (!e.currentTarget.contains(to)) lastFocused.current = null
        return
      }
      // Focus went nowhere. If the element is still in the page a moment later, the person let go of it; if it was removed
      // by an update, it is remembered until the update has been applied.
      setTimeout(() => {
        if (lastFocused.current === from && from.isConnected) lastFocused.current = null
      }, 0)
    },
  }
  return { keyOf, message, summaryRef, rootProps }
}
