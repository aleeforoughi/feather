// SwitchExperience: a plan rendered by the web manifestation, operated with one or two switches.
//
// Scanning is a layer over PlanView, not a second renderer: it finds the controls in the DOM (see targets.ts), gives
// the highlighted one real focus, and selects it with `click()`, so every act reaches `onReply` exactly as it does by
// mouse or keyboard. Nothing here re-decides what the plan decided.
//
// The highlight is three signals, none of them colour alone: real focus (so assistive technology reads the control),
// a 2px outline with a 2px offset in the `ring` token (shape, not hue), and "Selected for scanning" as a sr-only
// description on the control (aria-describedby, read once on focus; there is no live region). The wrapper's
// `data-variant` is "scanned" while a control is highlighted, and the control carries `data-scanned="true"`.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import type { Experience, Issue, ReplyEvent, ReplyIssue } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { PlanView, useShownPlan } from "@aleeforoughi/feather-manifest-web"
import { findBySignature, isCommitting, isTextEntry, scopeOf, signatureOf, targetAt, targetsIn, type TargetSignature } from "./targets"

export interface SwitchKeys {
  /** Keys (KeyboardEvent.key) that select the highlighted target. */
  select: string[]
  /** Keys that move to the next target (step mode; in auto mode they act as select keys do not). */
  next: string[]
}

/** The timers scanning uses. Inject one to drive scanning without waiting; the default is the window's. */
export interface ScanClock {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
  setInterval: (fn: () => void, ms: number) => unknown
  clearInterval: (id: unknown) => void
}

const windowClock: ScanClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as number),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as number),
}

export const DEFAULT_KEYS: Record<"auto" | "step", SwitchKeys> = {
  auto: { select: [" ", "Enter"], next: [] },
  step: { select: ["Enter"], next: ["Tab", " "] },
}

export interface SwitchExperienceProps {
  plan: LayoutPlan
  onReply: (reply: ReplyEvent) => void
  experience?: Experience
  onRejectedReply?: (issues: ReplyIssue[], reply: unknown) => void
  /** "auto": one switch, the highlight advances by itself; "step": two switches, one moves and one selects. Default "auto". */
  scan?: "auto" | "step"
  /** How long the highlight rests on a target in auto mode (default 1500). */
  scanMs?: number
  /** Resting the pointer on a target this long selects it. Never a committing control. Unset: no dwell. */
  dwellMs?: number
  keys?: SwitchKeys
  /**
   * Where the switch keys are heard. "experience" (default): only when the event target is inside the scanner (or inside
   * a popup it owns), so the rest of the page keeps Tab, Space and Enter; the scanner itself is focusable, so a switch
   * user can start there. "document": anywhere on the page, for a page that is nothing but the experience. Shift+Tab is
   * never captured, in either mode.
   */
  listen?: "experience" | "document"
  /** Timers, injectable for tests. */
  clock?: ScanClock
  className?: string
}

type ScanState = "idle" | "scanned" | "paused"

const HINT_TEXT = "Selected for scanning"

function addDescribedBy(el: HTMLElement, id: string) {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
  if (!ids.includes(id)) el.setAttribute("aria-describedby", [...ids, id].join(" "))
}
function removeDescribedBy(el: HTMLElement, id: string) {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x && x !== id)
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "))
  else el.removeAttribute("aria-describedby")
}

export function SwitchExperience({ plan, onReply, experience, onRejectedReply, scan = "auto", scanMs = 1500, dwellMs, keys, listen = "experience", clock = windowClock, className }: SwitchExperienceProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const hintId = React.useId()
  const [state, setState] = React.useState<ScanState>("idle")
  const reduced = plan.motion === "reduced"

  // Everything the listeners read, kept in a ref so the listeners are attached once per configuration.
  const live = React.useRef({ scan, scanMs, dwellMs, keys: keys ?? DEFAULT_KEYS[scan], clock, listen })
  React.useLayoutEffect(() => {
    live.current = { scan, scanMs, dwellMs, keys: keys ?? DEFAULT_KEYS[scan], clock, listen }
  })

  // What scanning keeps when the plan changes under it (an update, docs/lifecycle.md section 2): whether it has begun, and
  // which target the highlight was on.
  const carry = React.useRef<{ scan: string; started: boolean; el: HTMLElement | null; sig: TargetSignature | null } | null>(null)

  React.useEffect(() => {
    const host = root.current
    if (!host) return
    const doc = host.ownerDocument
    const saved = carry.current
    carry.current = null
    let current: HTMLElement | null = null
    let currentSig: TargetSignature | null = null
    let started = false // auto mode: the first press has happened
    let paused = false
    let interval: unknown = null
    let dwell: { el: HTMLElement; id: unknown } | null = null

    const targets = () => targetsIn(scopeOf(host))
    const publish = () => setState(paused ? "paused" : current ? "scanned" : "idle")

    const unmark = () => {
      if (!current) return
      current.removeAttribute("data-scanned")
      removeDescribedBy(current, hintId)
    }
    const mark = (el: HTMLElement) => {
      if (current && current !== el) unmark()
      current = el
      currentSig = signatureOf(el, targets())
      el.setAttribute("data-scanned", "true")
      addDescribedBy(el, hintId)
      // Real focus is how assistive technology announces the target. Where the highlight sits is never scrolled to
      // abruptly when motion is reduced.
      el.focus({ preventScroll: false })
      if (isTextEntry(el)) paused = true
      publish()
    }
    const clear = () => {
      unmark()
      current = null
      publish()
    }
    const stopTimer = () => {
      if (interval !== null) live.current.clock.clearInterval(interval)
      interval = null
    }
    /** Move the highlight on by one, wrapping. With none left, scanning stops. */
    const advance = () => {
      const list = targets()
      if (list.length === 0) {
        stopTimer()
        started = false
        clear()
        return
      }
      const at = current ? list.indexOf(current) : -1
      // A highlighted control that has gone (disarming removes "Yes, …") leaves the next one at its old place.
      mark(list[(at + 1) % list.length])
    }
    const startTimer = () => {
      stopTimer()
      if (live.current.scan !== "auto" || !started) return
      interval = live.current.clock.setInterval(() => {
        if (!paused) advance()
      }, live.current.scanMs)
    }
    /** Select a target: a click, so the organism's own handlers run. */
    const select = (el: HTMLElement) => {
      if (isTextEntry(el)) {
        mark(el)
        return
      }
      el.click()
      // What the act changed decides where the highlight goes: an organism that moved focus (arming moves it to the
      // confirm button) is followed; otherwise the highlight stays where it was if that control is still there.
      const list = targets()
      const focused = targetAt(doc.activeElement, list)
      if (focused && host.contains(focused)) mark(focused)
      else if (list.length === 0) {
        stopTimer()
        started = false
        clear()
        return
      } else if (!list.includes(el)) {
        mark(list[0])
      }
      startTimer()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === "Tab" && e.shiftKey) return
      if (live.current.listen === "experience") {
        const scope = scopeOf(host)
        const from = e.target instanceof Node ? e.target : null
        if (!from || !(host.contains(from) || (scope !== host && scope.contains(from)))) return
      }
      const k = live.current.keys
      const active = doc.activeElement
      const inField = active instanceof HTMLElement && host.contains(active) && isTextEntry(active)
      if (inField && (e.key === "Escape" || (live.current.scan === "step" && k.next.includes(e.key) && e.key.length > 1))) {
        // In a text field, Escape (and a non-printable "next" key) belongs to the scanner: the organism never sees it, so
        // nothing backs out and nothing typed is lost. Scanning resumes on the next target after the field.
        e.preventDefault()
        e.stopPropagation()
        paused = false
        if (current !== active) {
          unmark()
          current = active
        }
        if (live.current.scan === "auto" && !started) {
          // Scanning has not begun, so there is nothing to resume: the field just lets go.
          active.blur()
          publish()
        } else advance()
        return
      }
      if (paused) return
      const isSelect = k.select.includes(e.key)
      const isNext = k.next.includes(e.key)
      if (!isSelect && !isNext) return
      // A switch press is handled wherever focus is inside the page, unless focus is in a field elsewhere.
      if (isTextEntry(doc.activeElement) && !host.contains(doc.activeElement)) return
      e.preventDefault()
      if (live.current.scan === "auto") {
        if (!started) {
          // The first press only starts scanning. It never selects.
          started = true
          advance()
          startTimer()
        } else if (current && targets().includes(current)) select(current)
        else advance()
        return
      }
      // step mode
      if (isNext) {
        if (!current) {
          const list = targets()
          const here = targetAt(doc.activeElement, list)
          if (here && list.length > 0 && host.contains(here)) mark(list[(list.indexOf(here) + 1) % list.length])
          else advance()
        } else advance()
      } else if (isSelect) {
        const list = targets()
        const target = current && list.includes(current) ? current : targetAt(doc.activeElement, list)
        if (target) select(target)
      }
    }
    // A key that selects must not also do what the browser does on release (Space clicks a focused button).
    const onKeyUp = (e: KeyboardEvent) => {
      const k = live.current.keys
      if (!paused && (k.select.includes(e.key) || k.next.includes(e.key)) && host.contains(doc.activeElement) && !isTextEntry(doc.activeElement)) e.preventDefault()
    }
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null
      if (!el) return
      if (isTextEntry(el)) {
        paused = true
        publish()
        return
      }
      if (paused) {
        paused = false
        publish()
      }
      // Focus that the organisms moved (arming, a result) becomes the highlight once scanning has begun.
      if (started || live.current.scan === "step") {
        const t = targetAt(el, targets())
        if (t && t !== current && current) mark(t)
      }
    }

    const cancelDwell = () => {
      if (dwell) live.current.clock.clearTimeout(dwell.id)
      dwell = null
    }
    const onEnter = (e: Event) => {
      const ms = live.current.dwellMs
      if (ms === undefined) return
      const el = targetAt(e.target, targets())
      if (!el) return
      if (dwell?.el === el) return
      cancelDwell()
      const id = live.current.clock.setTimeout(() => {
        dwell = null
        // Dwell may arm. It may not commit: that takes the switch itself.
        if (isCommitting(el) || !targets().includes(el)) return
        mark(el)
        select(el)
      }, ms)
      dwell = { el, id }
    }
    const onLeave = (e: Event) => {
      if (!dwell) return
      const to = (e as PointerEvent).relatedTarget
      if (e.type === "pointerout" && to instanceof Node && dwell.el.contains(to)) return
      if (e.type === "pointerleave" && e.target !== dwell.el && !dwell.el.contains(e.target as Node)) return
      cancelDwell()
    }

    doc.addEventListener("keydown", onKeyDown, true)
    doc.addEventListener("keyup", onKeyUp, true)
    host.addEventListener("focusin", onFocusIn)
    host.addEventListener("pointerenter", onEnter, true)
    host.addEventListener("pointerover", onEnter)
    host.addEventListener("pointerleave", onLeave, true)
    host.addEventListener("pointerout", onLeave)

    // After an update: rescan. The highlight stays on the same target if it is still there, else it goes to the first.
    // Scanning that had begun goes on; scanning that had not is never started here. A collapsed plan has no targets, so
    // scanning stops.
    if (saved && saved.scan === scan) {
      const list = targets()
      if (list.length === 0) {
        started = false
      } else {
        started = saved.started
        if (saved.sig) {
          const same = saved.el && list.includes(saved.el) ? saved.el : findBySignature(saved.sig, list)
          mark(same ?? list[0]!)
        }
        startTimer()
      }
    }
    return () => {
      carry.current = { scan, started, el: current, sig: currentSig }
      doc.removeEventListener("keydown", onKeyDown, true)
      doc.removeEventListener("keyup", onKeyUp, true)
      host.removeEventListener("focusin", onFocusIn)
      host.removeEventListener("pointerenter", onEnter, true)
      host.removeEventListener("pointerover", onEnter)
      host.removeEventListener("pointerleave", onLeave, true)
      host.removeEventListener("pointerout", onLeave)
      stopTimer()
      cancelDwell()
      unmark()
    }
    // One scanner per plan and mode; the rest is read from `live`.
  }, [plan, scan, scanMs, dwellMs, clock, hintId])

  // The ring, in the `ring` token: the same 2px outline with a 2px offset as the focus ring (docs/visual-system.md section 8), so it is a shape and
  // not only a hue. It appears on the `focus` motion role.
  // With reduced motion nothing about it transitions.
  const ring =
    "[&_[data-scanned=true]]:outline-2 [&_[data-scanned=true]]:outline-offset-2 [&_[data-scanned=true]]:outline-solid [&_[data-scanned=true]]:outline-ring"
  const motion = reduced ? "[&_[data-scanned]]:transition-none" : "[&_[data-scanned]]:motion-focus"
  return (
    <div ref={root} role="group" tabIndex={0} aria-label="Switch scanning: press Space or Enter to start" data-slot="switch-scanner" data-variant={state} data-scan={scan} data-motion={plan.motion} className={[ring, motion, className ?? ""].filter(Boolean).join(" ")}>
      <span id={hintId} data-slot="switch-scan-hint" className="sr-only">
        {HINT_TEXT}
      </span>
      <PlanView plan={plan} onReply={onReply} experience={experience} onRejectedReply={onRejectedReply} />
    </div>
  )
}

export interface FeatherSwitchExperienceProps extends Omit<SwitchExperienceProps, "plan" | "experience"> {
  /** The Experience IR, as the caller sent it. It is validated; it need not be trusted. */
  experience: unknown
  context: RenderContext
  /** Called with the validator's issues when the IR is invalid; the component then renders nothing. */
  onIssues?: (issues: Issue[]) => void
}

/** Composes `experience` for `context` and renders it for switch access. An invalid IR renders nothing. */
export function FeatherSwitchExperience({ experience, context, onIssues, ...rest }: FeatherSwitchExperienceProps) {
  // A plan whose revision is not higher than the one shown is ignored (docs/lifecycle.md section 2.6).
  const shown = useShownPlan(experience, context, onIssues)
  if (!shown) return null
  return <SwitchExperience plan={shown.plan} experience={shown.experience} {...rest} />
}
