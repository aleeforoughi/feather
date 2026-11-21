import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { disclosureLine, isDisclosure, type Speaker } from "../core/disclosure"

export interface ComposerProps extends Omit<React.HTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** Whose words the agent speaks from. Required: the disclosure line is visible before the first word. */
  speaker: Speaker
  /** The brand's own disclosure line. It must say it is an AI agent; otherwise the default line is used. */
  disclosure?: string
  /** The visitor sent words (Enter, or the Send button). */
  onSend: (text: string) => void
  /** The visitor pressed Stop while an answer streams. */
  onStop?: () => void
  /** An answer is streaming: the Send button becomes Stop, in the same place. */
  streaming?: boolean
  placeholder?: string
  /** Suggested first asks, as buttons that send. */
  starters?: string[]
}

// `field-sizing: content` makes the textarea grow with its text; min-h-10 and a 192px max-height hold it between 40 and 192px.
const GROW = { fieldSizing: "content", maxHeight: 192 } as React.CSSProperties

/**
 * Composer: the one input of a Living Page. It tells the visitor it is an AI agent before they type, grows from one
 * line to a calm maximum, and sends with Enter (Shift+Enter adds a line; an IME composition never sends).
 */
export function Composer({ speaker, disclosure, onSend, onStop, streaming = false, placeholder, starters, className, ...props }: ComposerProps) {
  const [text, setText] = React.useState("")
  const reduced = useReducedMotion()
  const still = reduced && "transition-none"
  const ids = React.useId()
  const descId = `${ids}-disclosure`
  const line = React.useMemo(() => {
    if (disclosure === undefined) return disclosureLine(speaker)
    if (isDisclosure(disclosure)) return disclosure
    console.warn("Composer: `disclosure` must say it is an AI agent; using the default line.")
    return disclosureLine(speaker)
  }, [disclosure, speaker])

  const send = (value: string) => {
    const t = value.trim()
    if (!t) return
    onSend(t)
    setText("")
  }
  const empty = text.trim().length === 0
  const label = `Ask ${speaker.name}`

  return (
    <form data-slot="composer" data-variant={streaming ? "streaming" : "idle"} aria-label="Conversation" onSubmit={(e) => e.preventDefault()} className={cn("composer-edge rounded-dialog flex w-full max-w-3xl flex-col gap-2 border bg-surface-raised p-4", className)} {...props}>
      <p id={descId} data-slot="composer-disclosure" className="type-caption text-fg-secondary">
        {line}
      </p>
      {starters && starters.length > 0 ? (
        <div data-slot="composer-starters" className="flex flex-wrap gap-2">
          {starters.map((s) => (
            <button key={s} type="button" data-slot="composer-starter" onClick={() => send(s)} className={cn("type-label rounded-control h-control focus-ring border border-line-secondary bg-surface-base px-4 text-fg-primary motion-state", still)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div data-slot="composer-row" className="flex items-end gap-2">
        <textarea
          data-slot="composer-input"
          aria-label={label}
          aria-describedby={descId}
          rows={1}
          value={text}
          placeholder={placeholder ?? label}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            send(text)
          }}
          style={GROW}
          className="type-body min-h-10 w-full resize-none bg-transparent py-2 text-fg-primary placeholder:text-fg-tertiary focus-visible:outline-none"
        />
        <button
          type="button"
          data-slot="composer-action"
          data-variant={streaming ? "stop" : "send"}
          aria-label={streaming ? "Stop" : "Send"}
          disabled={!streaming && empty}
          onClick={() => (streaming ? onStop?.() : send(text))}
          className={cn("rounded-control focus-ring flex size-12 shrink-0 items-center justify-center bg-surface-inverse text-fg-inverse motion-state disabled:bg-surface-disabled disabled:text-fg-disabled", still)}
        >
          {streaming ? (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
            </svg>
          )}
        </button>
      </div>
    </form>
  )
}
