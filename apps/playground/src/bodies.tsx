// One body for each manifestation a plan can name: web, switch, voice and text. Each renders the plan it is given and
// sends the same reply events. Nothing here re-decides what the plan decided, and nothing is stored.
import * as React from "react"
import type { Experience, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"
import { createDialog, type Dialog } from "@aleeforoughi/feather-dialog"
import { PlanView } from "@aleeforoughi/feather-manifest-web"
import { SwitchExperience } from "@aleeforoughi/feather-manifest-switch"
import { renderTurn } from "@aleeforoughi/feather-manifest-text"
import { createVoiceDialog, speechFor, type Speech, type VoiceDialog } from "@aleeforoughi/feather-manifest-voice"
import { Checkbox, Input, Label } from "@aleeforoughi/feather-react"

export interface BodyProps {
  plan: LayoutPlan
  experience: Experience
  /** Every reply, with the name of the body that sent it. */
  onReply: (reply: ReplyEvent, body: string) => void
}

const LOG = "max-h-96 min-h-24 overflow-auto rounded-lg border bg-muted p-3 text-sm text-foreground"

/** Derived state that starts over when the plan does, without an effect. */
function useSession<T>(plan: LayoutPlan, experience: Experience, make: () => T): T {
  const [session, setSession] = React.useState(() => ({ plan, experience, value: make() }))
  if (session.plan !== plan || session.experience !== experience) {
    const next = { plan, experience, value: make() }
    setSession(next)
    return next.value
  }
  return session.value
}

function Line({ id, label, hint, value, onChange, onSubmit }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} autoComplete="off" spellCheck={false} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </form>
  )
}

/** Text: a terminal-like panel. The conversation is one growing log; the replies that went out are lines in it. */
export function TextBody({ plan, experience, onReply }: BodyProps) {
  const id = React.useId()
  const dialog = useSession<Dialog>(plan, experience, () => createDialog(plan, { experience }))
  const [log, setLog] = React.useState<{ dialog: Dialog; text: string }>(() => ({ dialog, text: renderTurn(dialog.turn) }))
  const [line, setLine] = React.useState("")
  const text = log.dialog === dialog ? log.text : renderTurn(dialog.turn)
  const submit = () => {
    const input = line
    setLine("")
    const out = dialog.answer(input)
    const sent = out.replies.map((r) => `reply sent: ${JSON.stringify(r)}\n`).join("")
    setLog({ dialog, text: `${text}${input}\n\n${sent}${sent ? "\n" : ""}${renderTurn(out.turn)}` })
    for (const r of out.replies) onReply(r, "text")
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

type Said = { who: "feather" | "you"; text: string }
const speak = (speech: Speech[]) => {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return
  for (const s of speech) {
    const u = new SpeechSynthesisUtterance(s.text)
    u.lang = s.lang
    synth.speak(u)
  }
}

/** Voice: what Feather says, in order, and a line for what the person said, as the engine transcribed it. */
export function VoiceBody({ plan, experience, onReply }: BodyProps) {
  const id = React.useId()
  const voice = useSession<VoiceDialog>(plan, experience, () => createVoiceDialog(plan, { experience }))
  const [said, setSaid] = React.useState<{ voice: VoiceDialog; items: Said[] }>(() => ({ voice, items: [] }))
  const [line, setLine] = React.useState("")
  const [aloud, setAloud] = React.useState(false)
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window
  const opening = React.useMemo<Said[]>(() => speechFor(voice.turn, plan).map((s) => ({ who: "feather", text: s.text })), [voice, plan])
  const items = said.voice === voice ? said.items : []
  const shown = said.voice === voice ? [...(items.length ? [] : opening), ...items] : opening
  React.useEffect(() => {
    if (!aloud && canSpeak) window.speechSynthesis.cancel()
  }, [aloud, canSpeak])
  React.useEffect(() => () => (canSpeak ? window.speechSynthesis.cancel() : undefined), [canSpeak])
  const submit = () => {
    const input = line.trim()
    if (!input) return
    setLine("")
    const out = voice.hear([input])
    const base = items.length ? items : opening
    setSaid({ voice, items: [...base, { who: "you", text: input }, ...out.speech.map((s): Said => ({ who: "feather", text: s.text }))] })
    if (aloud) speak(out.speech)
    for (const r of out.replies) onReply(r, "voice")
  }
  return (
    <div data-slot="playground-voice" className="flex flex-col gap-2">
      <div data-testid="voice-log" role="log" aria-live="polite" aria-label="Transcript" tabIndex={0} className={`${LOG} flex flex-col gap-1`}>
        {shown.map((s, i) => (
          <p key={i} data-variant={s.who} className={s.who === "you" ? "pl-4" : undefined}>
            <span className="font-medium">{s.who === "feather" ? "Feather says:" : "You said:"}</span> {s.text}
          </p>
        ))}
      </div>
      <Line id={`${id}-in`} label="Say (as transcribed)" hint="Press Enter to send what you said." value={line} onChange={setLine} onSubmit={submit} />
      {canSpeak && (
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-aloud`} checked={aloud} onCheckedChange={(c) => setAloud(c === true)} />
          <Label htmlFor={`${id}-aloud`}>Speak aloud</Label>
        </div>
      )}
    </div>
  )
}

/**
 * Switch: two switches, Tab to move and Enter to select. The scanner hears keys only inside itself (its default), so
 * the page around it keeps Tab, Space and Enter, and Shift+Tab leaves it.
 */
export function SwitchBody({ plan, experience, onReply }: BodyProps) {
  return (
    <div data-slot="playground-switch" className="flex flex-col gap-2">
      <p data-testid="switch-hint" className="text-sm text-muted-foreground">Tab: next · Enter: select</p>
      <SwitchExperience plan={plan} experience={experience} scan="step" onReply={(r) => onReply(r, "switch")} />
    </div>
  )
}

/** The body the plan names. */
export function Body(props: BodyProps) {
  switch (props.plan.manifestation) {
    case "switch":
      return <SwitchBody {...props} />
    case "text":
      return <TextBody {...props} />
    case "voice":
      return <VoiceBody {...props} />
    default:
      return <PlanView plan={props.plan} experience={props.experience} onReply={(r) => props.onReply(r, "web")} autoFocus={false} />
  }
}
