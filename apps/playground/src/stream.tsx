// "Stream": an experience over time (docs/lifecycle.md). The playground is the caller here: it owns the revision and the
// clock, applies each update with applyUpdate, and hands the body the new experience. The body changes in place, and
// when the experience resolves it collapses to its summary and artifact. Nothing is stored or logged.
import * as React from "react"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { createDialog } from "@aleeforoughi/feather-dialog"
import { applyUpdate, formatIssues, type Experience, type ReplyEvent, type UpdateIssue } from "@aleeforoughi/feather-intent"
import { compose, REFERENCE_CONTEXTS, type LayoutPlan } from "@aleeforoughi/feather-liquid"
import { FeatherSwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import { renderTurn } from "@aleeforoughi/feather-manifest-text"
import { createVoiceDialog, speechFor, type VoiceDialog } from "@aleeforoughi/feather-manifest-voice"
import { FeatherExperience } from "@aleeforoughi/feather-manifest-web"
import { Button, Label, Textarea } from "@aleeforoughi/feather-react"
import { Line, LOG } from "./bodies"
import { Choice } from "./controls"

interface Stream {
  description: string
  experience: Experience
  updates: Array<{ revision: number }>
}
const STREAM = Object.values(import.meta.glob<Stream>("../../../conformance/update/valid/streamed-trip.json", { eager: true, import: "default" }))[0]!

/** The plan for an experience that is known to be valid (every experience here is the result of applyUpdate). */
function planOf(experience: Experience, context: RenderContext): LayoutPlan {
  const result = compose(experience, context)
  if (!result.ok) throw new Error("the stream's experience is not valid")
  return result.plan
}

const BODIES = [
  { value: "web", label: "Web" },
  { value: "switch", label: "Switch" },
  { value: "text", label: "Text transcript" },
  { value: "voice", label: "Voice transcript" },
]
const DEVICES = [
  { value: "phone", label: "Phone" },
  { value: "desktop", label: "Desktop" },
]
const AUTO_MS = 2000

/** The context each body is reached by (docs/manifestations.md section 5); the device only matters for the web. */
function contextFor(body: string, device: string): RenderContext {
  switch (body) {
    case "switch":
      return { capability: { input: { switch: true } } }
    case "text":
      return { device: { surface: "terminal" } }
    case "voice":
      return REFERENCE_CONTEXTS.screenless.context
    default:
      return { device: { surface: device as "phone" | "desktop", width: device === "phone" ? 390 : 1280 } }
  }
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2)
const noMotion = (cb: () => void) => {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)")
  q.addEventListener("change", cb)
  return () => q.removeEventListener("change", cb)
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

interface Step {
  experience: Experience
  plan: LayoutPlan
}
interface Typed {
  /** Which step was current when it was typed. */
  at: number
  text: string
}

/**
 * What the text and voice bodies show is a pure function of the experiences they were handed and what the person typed:
 * the dialog is deterministic, so it is brought to the current state by replaying both, in order. Nothing is mutated in
 * render, and a body chosen mid-stream starts from the experience that was current then.
 */
function useSteps(history: Experience[], context: RenderContext): { steps: Step[]; onTyped: (text: string, steps: Step[]) => Typed } {
  const [base] = React.useState(history.length - 1)
  const steps = React.useMemo(() => history.slice(base).map((experience) => ({ experience, plan: planOf(experience, context) })), [history, base, context])
  return { steps, onTyped: (text, s) => ({ at: s.length - 1, text }) }
}

function replayText(steps: Step[], inputs: Typed[]): { text: string; replies: ReplyEvent[] } {
  const dialog = createDialog(steps[0]!.plan, { experience: steps[0]!.experience })
  let text = renderTurn(dialog.turn)
  let replies: ReplyEvent[] = []
  steps.forEach((step, k) => {
    if (k > 0) {
      const before = dialog.turn
      const turn = dialog.update(step.plan, { experience: step.experience })
      if (turn !== before) text = `${text}\n${renderTurn(turn)}`
    }
    for (const typed of inputs.filter((i) => i.at === k)) {
      const out = dialog.answer(typed.text)
      replies = out.replies
      const sent = out.replies.map((r) => `reply sent: ${JSON.stringify(r)}\n`).join("")
      text = `${text}${typed.text}\n\n${sent}${sent ? "\n" : ""}${renderTurn(out.turn)}`
    }
  })
  return { text, replies }
}

type Said = { who: "feather" | "you"; text: string }

function replayVoice(steps: Step[], inputs: Typed[]): { items: Said[]; replies: ReplyEvent[] } {
  const voice: VoiceDialog = createVoiceDialog(steps[0]!.plan, { experience: steps[0]!.experience })
  const items: Said[] = speechFor(voice.turn, steps[0]!.plan).map((s) => ({ who: "feather", text: s.text }))
  let replies: ReplyEvent[] = []
  steps.forEach((step, k) => {
    if (k > 0) for (const s of voice.hearUpdate(step.plan, { experience: step.experience }).speech) items.push({ who: "feather", text: s.text })
    for (const typed of inputs.filter((i) => i.at === k)) {
      const out = voice.hear([typed.text])
      replies = out.replies
      items.push({ who: "you", text: typed.text }, ...out.speech.map((s): Said => ({ who: "feather", text: s.text })))
    }
  })
  return { items, replies }
}

interface TranscriptProps {
  history: Experience[]
  context: RenderContext
  onReply: (r: ReplyEvent, body: string) => void
}

/** Text: one growing log. The first turn, then what each update says, and the replies that went out. */
function StreamText({ history, context, onReply }: TranscriptProps) {
  const id = React.useId()
  const { steps, onTyped } = useSteps(history, context)
  const [inputs, setInputs] = React.useState<Typed[]>([])
  const [line, setLine] = React.useState("")
  const { text } = React.useMemo(() => replayText(steps, inputs), [steps, inputs])
  const submit = () => {
    const typed = onTyped(line, steps)
    setLine("")
    const next = [...inputs, typed]
    setInputs(next)
    for (const r of replayText(steps, next).replies) onReply(r, "text")
  }
  return (
    <div data-slot="playground-text" className="flex flex-col gap-2">
      <pre data-testid="text-log" role="log" aria-live="polite" aria-label="Conversation" tabIndex={0} className={`${LOG} whitespace-pre-wrap font-mono`}>
        {text}
      </pre>
      <Line id={`${id}-in`} label="Type a reply" hint="Press Enter to send." value={line} onChange={setLine} onSubmit={submit} />
    </div>
  )
}

/** Voice: what Feather says, in order, including what each update says; a line for what the person said. */
function StreamVoice({ history, context, onReply }: TranscriptProps) {
  const id = React.useId()
  const { steps, onTyped } = useSteps(history, context)
  const [inputs, setInputs] = React.useState<Typed[]>([])
  const [line, setLine] = React.useState("")
  const { items } = React.useMemo(() => replayVoice(steps, inputs), [steps, inputs])
  const submit = () => {
    const input = line.trim()
    if (!input) return
    const typed = onTyped(input, steps)
    setLine("")
    const next = [...inputs, typed]
    setInputs(next)
    for (const r of replayVoice(steps, next).replies) onReply(r, "voice")
  }
  return (
    <div data-slot="playground-voice" className="flex flex-col gap-2">
      <div data-testid="voice-log" role="log" aria-live="polite" aria-label="Transcript" tabIndex={0} className={`${LOG} flex flex-col gap-label`}>
        {items.map((s, i) => (
          <p key={i} data-variant={s.who} className={s.who === "you" ? "pl-4" : undefined}>
            <span className="font-medium">{s.who === "feather" ? "Feather says:" : "You said:"}</span> {s.text}
          </p>
        ))}
      </div>
      <Line id={`${id}-in`} label="Say (as transcribed)" hint="Press Enter to send what you said." value={line} onChange={setLine} onSubmit={submit} />
    </div>
  )
}

export function StreamView({ onReply }: { onReply: (reply: ReplyEvent, body: string) => void }) {
  // Every experience since the start: the last is the current one. The text and voice bodies replay from it.
  const [history, setHistory] = React.useState<Experience[]>([STREAM.experience])
  const experience = history[history.length - 1]!
  const [last, setLast] = React.useState<unknown>(null)
  const [issues, setIssues] = React.useState<UpdateIssue[] | null>(null)
  const [body, setBody] = React.useState("web")
  const [device, setDevice] = React.useState("phone")
  const [run, setRun] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [pasted, setPasted] = React.useState(() => pretty(STREAM.updates[0]))
  const [pasteProblem, setPasteProblem] = React.useState<string | null>(null)
  const reduced = React.useSyncExternalStore(noMotion, prefersReducedMotion, () => false)
  const pasteId = React.useId()

  const revision = experience.revision ?? 0
  const resolved = experience.resolved !== undefined
  // The scripted update that makes the next revision. A pasted one may have moved the revision on, or past the script.
  const next = STREAM.updates.find((u) => u.revision === revision + 1)
  const context = React.useMemo(() => contextFor(body, device), [body, device])
  const playable = playing && !!next && !resolved

  /** Applies an update to the current experience; a refused one changes nothing and its issues are shown. */
  const apply = React.useCallback(
    (update: unknown) => {
      const result = applyUpdate(experience, update)
      setLast(update)
      if (result.ok) {
        setHistory((h) => [...h, result.experience])
        setIssues(null)
      } else {
        setIssues(result.issues)
      }
      return result
    },
    [experience],
  )

  // Auto-play never starts by itself. It waits where a person is asked to approve: the caller decides when to go on.
  React.useEffect(() => {
    if (!playable) return
    const t = setTimeout(() => {
      const result = apply(next)
      if (!result.ok || result.experience.nodes.some((n) => n.type === "Approval")) setPlaying(false)
    }, AUTO_MS)
    return () => clearTimeout(t)
  }, [playable, next, apply])

  // Restarting, or choosing another body, mounts the body afresh, as a new session would.
  const restart = () => {
    setHistory([STREAM.experience])
    setLast(null)
    setIssues(null)
    setPlaying(false)
    setPasteProblem(null)
    setRun((n) => n + 1)
  }
  const applyPasted = () => {
    let update: unknown
    try {
      update = JSON.parse(pasted)
    } catch (err) {
      setPasteProblem(`This is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    setPasteProblem(null)
    apply(update)
  }

  const key = `${run}-${body}`
  return (
    <div data-testid="stream-view" className="flex flex-col gap-4">
      <p className="type-body-sm text-fg-secondary">
        You are the caller. Each update is applied with <code className="font-mono">applyUpdate</code> and the body is handed the new experience, which changes in place. When it resolves, only the summary and the artifact stay.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Choice label="Body" value={body} items={BODIES} onChange={(v) => setBody(v || "web")} />
        <Choice label="Device (web)" value={device} items={DEVICES} onChange={(v) => setDevice(v || "phone")} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p data-testid="stream-revision" data-revision={revision} className="type-label">
          Revision {revision}
          <span className="font-normal text-fg-secondary"> · {resolved ? "resolved" : next ? `next: ${next.revision}` : "no scripted update left"}</span>
        </p>
        <Button data-testid="stream-next" onClick={() => { setPlaying(false); if (next) apply(next) }} disabled={!next}>
          Next update
        </Button>
        {!reduced && (
          <Button variant="outline" data-testid="stream-play" aria-pressed={playable} onClick={() => setPlaying(!playable)} disabled={!next || resolved}>
            {playable ? "Pause" : "Play"}
          </Button>
        )}
        <Button variant="outline" data-testid="stream-restart" onClick={restart}>
          Restart
        </Button>
      </div>
      {reduced && <p className="type-caption text-fg-secondary">Reduced motion is on, so there is no auto-play. Use Next update.</p>}

      <section aria-label="Rendered experience" data-testid="stream-rendered" data-body={body} className="flex flex-col gap-2">
        {body === "text" ? (
          <StreamText key={key} history={history} context={context} onReply={onReply} />
        ) : body === "voice" ? (
          <StreamVoice key={key} history={history} context={context} onReply={onReply} />
        ) : body === "switch" ? (
          <div data-slot="playground-switch">
            <p data-testid="switch-hint" className="type-body-sm text-fg-secondary">Tab: next · Enter: select</p>
            <FeatherSwitchExperience key={key} experience={experience} context={context} scan="step" onReply={(r) => onReply(r, "switch")} />
          </div>
        ) : (
          <FeatherExperience key={key} experience={experience} context={context} autoFocus={false} onReply={(r) => onReply(r, "web")} />
        )}
      </section>

      <div className="flex flex-col gap-label">
        <p className="type-label">Update just applied</p>
        <pre data-testid="stream-last-update" className="min-h-control max-h-72 overflow-auto rounded-control bg-muted px-control py-3 font-mono type-caption">{last === null ? "none yet" : pretty(last)}</pre>
      </div>
      {issues && (
        <div data-testid="stream-issues" role="status" className="rounded-card border border-destructive inset-content type-body-sm">
          <p className="font-medium">This update was refused. What is shown has not changed.</p>
          <pre className="mt-3 whitespace-pre-wrap font-mono type-caption">{formatIssues(issues)}</pre>
        </div>
      )}

      <div className="flex flex-col gap-label">
        <Label htmlFor={pasteId}>Your own update (JSON, feather.update/1)</Label>
        <Textarea id={pasteId} data-testid="stream-editor" spellCheck={false} value={pasted} onChange={(e) => setPasted(e.target.value)} className="min-h-40 font-mono type-caption" />
        <div className="flex items-center gap-3">
          <Button variant="outline" data-testid="stream-apply" onClick={applyPasted}>
            Apply to the current experience
          </Button>
          {pasteProblem && <p data-testid="stream-paste-problem" role="status" className="type-body-sm text-destructive">{pasteProblem}</p>}
        </div>
      </div>
    </div>
  )
}
