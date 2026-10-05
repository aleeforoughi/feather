// Sessions: one experience kept on screen (or in conversation) while the caller updates it. Each body is driven the way a
// person drives it, and handed each update the way its documentation says: the web and the switch are given the new
// experience (they compose again and change in place), text and voice are given the newly composed plan. Nothing here reads
// a body's code; a body that fails the suite is fixed, never worked around (docs/lifecycle.md section 3).
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createDialog } from "@aleeforoughi/feather-dialog"
import type { Experience, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"
import { FeatherSwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import { CONTEXTS, planFor, type Body } from "../fixtures.ts"
import { planNodeOf, scenariosOf, type Scenario } from "../scenarios.ts"
import type { Step } from "./script.ts"
import { reach, key } from "./switch.tsx"
import { numberPhrase, driveTalk, type Style, type Talker } from "./talk.ts"
import { hostOf, scriptOf } from "./web.tsx"
import { voice } from "./voice.ts"

/** What a person is left with when the experience has collapsed, the same in every body. */
export interface Resolved {
  /** The summary, then the artifact as "{label}: {href}" (http and https only) or the label alone. */
  lines: string[]
  /** How many controls remain to act on (buttons, fields; the artifact link is not one). */
  controls: number
}

export interface Session {
  /** Hands the body the experience after an update. */
  show(experience: Experience): void
  /** The first step of an act that takes a deliberate second one (arms it). */
  arm(node: string, act: string): Promise<void>
  /** The deliberate step, tried once. The replies it caused; none when the body offers nothing to confirm with. */
  confirm(): Promise<ReplyEvent[]>
  /** The whole act, including its deliberate step. Every reply it caused. */
  act(node: string, act: string): Promise<ReplyEvent[]>
  /** The collapsed experience, as the body presents it. */
  resolved(): Resolved
  unmount(): void
}

/** The scenario for an act on a node of `experience`, as the plan the body would compose gives it. */
function scenarioFor(experience: Experience, node: string, actName: string): Scenario {
  const found = scenariosOf(experience.experience, experience, planFor(experience, "web")).find((s) => s.node === node && s.act === actName && !s.noReason)
  if (!found) throw new Error(`no ${actName} on "${node}" in the experience at revision ${experience.revision ?? 0}`)
  return found
}

const CONTROLS = 'button, input:not([type="hidden"]), textarea, select'

function domResolved(container: HTMLElement): Resolved {
  const status = container.querySelector('[data-slot="experience-resolution"]')
  if (!status) throw new Error('no element with data-slot="experience-resolution" in what was rendered')
  const summary = status.querySelector('[data-slot="experience-resolution-summary"]')?.textContent ?? ""
  const artifact = status.querySelector<HTMLElement>('[data-slot="experience-resolution-artifact"]')
  const label = (artifact?.textContent ?? "").replace(/\s*\(opens in a new tab\)\s*$/, "").trim()
  const href = artifact?.getAttribute("href")
  const lines = [summary]
  if (artifact) lines.push(href ? `${label}: ${href}` : label)
  return { lines, controls: container.querySelectorAll(CONTROLS).length }
}

/** The web body: FeatherExperience, handed each new experience, clicked and typed into. */
export function webSession(first: Experience): Session {
  const user = userEvent.setup()
  const replies: ReplyEvent[] = []
  let current = first
  let armed: { s: Scenario; steps: Step[] } | null = null
  const ui = (ex: Experience) => <FeatherExperience experience={ex} context={CONTEXTS.web} onReply={(r) => void replies.push(r)} />
  const { container, rerender, unmount } = render(ui(first))
  const run = async (s: Scenario, step: Step, required: boolean): Promise<boolean> => {
    const find = () => {
      try {
        return step.find(hostOf(container, s.node))
      } catch {
        return null
      }
    }
    const el = required ? await waitFor(() => find() ?? Promise.reject(new Error(`web: could not find ${step.what} in node "${s.node}"`))) : find()
    if (!el) return false
    if (step.kind === "press") {
      if (!step.skip?.(el)) await user.click(el)
    } else {
      await user.clear(el)
      await user.type(el, step.text)
    }
    return true
  }
  return {
    show(ex) {
      if ((ex.revision ?? 0) > (current.revision ?? 0)) current = ex
      rerender(ui(ex))
    },
    async arm(node, actName) {
      const s = scenarioFor(current, node, actName)
      const { script } = scriptOf({ name: current.experience, ir: current }, "web", s)
      armed = { s, steps: script.deliberate }
      for (const step of script.act) await run(s, step, true)
    },
    async confirm() {
      if (!armed) throw new Error("web: nothing was armed")
      const before = replies.length
      for (const step of armed.steps) if (!(await run(armed.s, step, false))) break
      return replies.slice(before)
    },
    async act(node, actName) {
      const s = scenarioFor(current, node, actName)
      const { script } = scriptOf({ name: current.experience, ir: current }, "web", s)
      const before = replies.length
      for (const step of [...script.act, ...script.deliberate]) await run(s, step, true)
      return replies.slice(before)
    },
    resolved: () => domResolved(container),
    unmount,
  }
}

/** The switch body: FeatherSwitchExperience in step mode, operated only by its next and select keys. */
export function switchSession(first: Experience): Session {
  const user = userEvent.setup()
  const replies: ReplyEvent[] = []
  let current = first
  let armed: { s: Scenario; steps: Step[] } | null = null
  const ui = (ex: Experience) => <FeatherSwitchExperience experience={ex} context={CONTEXTS.switch} scan="step" onReply={(r) => void replies.push(r)} />
  const { container, rerender, unmount } = render(ui(first))
  container.querySelector<HTMLElement>("[data-slot=switch-scanner]")?.focus()
  const run = async (s: Scenario, step: Step, required: boolean): Promise<boolean> => {
    const find = () => {
      try {
        return step.find(hostOf(container, s.node))
      } catch {
        return null
      }
    }
    if (required) await waitFor(() => { if (!find()) throw new Error(`switch: could not find ${step.what} in node "${s.node}"`) })
    else if (!find()) return false
    if (step.kind === "press") {
      if (step.skip?.(find()!)) return true
      reach(find, step.what)
      key("Enter")
    } else {
      const field = reach(find, step.what)
      await user.clear(field)
      await user.keyboard(step.text)
      key("Escape")
    }
    return true
  }
  return {
    show(ex) {
      if ((ex.revision ?? 0) > (current.revision ?? 0)) current = ex
      rerender(ui(ex))
    },
    async arm(node, actName) {
      const s = scenarioFor(current, node, actName)
      const { script } = scriptOf({ name: current.experience, ir: current }, "switch", s)
      armed = { s, steps: script.deliberate }
      for (const step of script.act) await run(s, step, true)
    },
    async confirm() {
      if (!armed) throw new Error("switch: nothing was armed")
      const before = replies.length
      for (const step of armed.steps) if (!(await run(armed.s, step, false))) break
      return replies.slice(before)
    },
    async act(node, actName) {
      const s = scenarioFor(current, node, actName)
      const { script } = scriptOf({ name: current.experience, ir: current }, "switch", s)
      const before = replies.length
      for (const step of [...script.act, ...script.deliberate]) await run(s, step, true)
      return replies.slice(before)
    },
    resolved: () => {
      // Nothing is left to act on: pressing "next" highlights no act. The artifact link may be highlighted (it is the
      // only target, docs/lifecycle.md 2.5); opening it sends no reply, so it is not an act.
      act(() => void fireEvent.keyDown(container.querySelector("[data-slot=switch-scanner]") ?? document.body, { key: "Tab" }))
      const r = domResolved(container)
      return { ...r, controls: r.controls + container.querySelectorAll('[data-scanned]:not([data-slot="experience-resolution-artifact"])').length }
    },
    unmount,
  }
}

interface Talking {
  talker: Talker & { update(plan: LayoutPlan, experience: Experience): void }
  dialogDone: () => boolean
}

function talkSession(first: Experience, style: Style, make: (plan: LayoutPlan, experience: Experience) => Talking): Session {
  let current = first
  let plan = planFor(first, style)
  const talking = make(plan, first)
  const { talker } = talking
  let armedPlan: LayoutPlan | null = null
  const turn = () => talker.turn
  const say = (phrase: string) => talker.say(phrase)
  return {
    show(ex) {
      // The body decides whether to apply it; this only remembers the newest, for choosing the next act.
      const next = planFor(ex, style)
      if ((ex.revision ?? 0) > (current.revision ?? 0)) {
        current = ex
        plan = next
      }
      talker.update(next, ex)
    },
    async arm(node, actName) {
      const choice = turn().choices.find((c) => c.node === node && c.act === actName)
      if (!choice) throw new Error(`${style}: no "${actName}" on "${node}" is offered (it offers ${turn().choices.map((c) => `${c.node}.${c.act}`).join(", ") || "nothing"})`)
      armedPlan = plan
      say(numberPhrase(choice.n, style))
    },
    async confirm() {
      // The person says the keyword the plan gave when they armed it, whatever the body now asks.
      const keyword = armedPlan && planNodeOf(armedPlan, "ok")?.keyword
      if (!keyword) throw new Error(`${style}: nothing was armed`)
      return say(keyword)
    },
    async act(node, actName) {
      const s = scenarioFor(current, node, actName)
      const r = driveTalk(talker, plan, s, style)
      return r.after ?? r.before
    },
    resolved() {
      const parts = turn().parts.map((p) => p.text)
      // Nothing to act on: no choices, and the dialog is done.
      return { lines: parts, controls: turn().choices.length + (talking.dialogDone() ? 0 : 1) }
    },
    unmount() {},
  }
}

export function textSession(first: Experience): Session {
  return talkSession(first, "text", (plan, experience) => {
    const dialog = createDialog(plan, { experience })
    return {
      talker: {
        get turn() {
          return dialog.turn
        },
        say: (line) => dialog.answer(line).replies,
        update: (next, ex) => void dialog.update(next, { experience: ex }),
      },
      dialogDone: () => dialog.done,
    }
  })
}

export function voiceSession(first: Experience): Session {
  const speech = voice
  if (!speech) throw new Error("@aleeforoughi/feather-manifest-voice does not exist")
  return talkSession(first, "voice", (plan, experience) => {
    const dialog = speech.createVoiceDialog(plan, { experience })
    return {
      talker: {
        get turn() {
          return dialog.turn
        },
        say: (phrase) => dialog.hear([phrase]).replies,
        sayAlternatives: (phrases) => dialog.hear(phrases).replies,
        update: (next, ex) => void dialog.hearUpdate(next, { experience: ex }),
      },
      dialogDone: () => dialog.done,
    }
  })
}

export const SESSIONS: Record<Body, (first: Experience) => Session> = { web: webSession, switch: switchSession, text: textSession, voice: voiceSession }
