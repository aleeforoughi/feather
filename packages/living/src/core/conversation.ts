// The conversation, as a pure reducer: the host streams events (from its model, or a prepared scene), and the reducer
// keeps the turns. No model call, no clock, no storage: Feather keeps nothing about the person (PLAN principle 11), and
// a turn lives in the page's memory only for this visit.
import type { Block } from "./blocks"

/** How a turn is going. "thinking" always has a named phase (never typing dots, never "Processing…"). */
export type TurnStatus = "thinking" | "speaking" | "done" | "error" | "stopped"

export interface Turn {
  id: string
  /** The visitor's words, verbatim: shown as a caption above what they caused. */
  ask: string
  /** The named phase before the first word ("Looking through the work"). */
  phase: string | null
  /** The spoken line, in the speaker's voice, as words so far (joined, it is the line). */
  words: string[]
  /** One to three blocks from the brand's library. */
  blocks: Block[]
  /** Two or three next asks. */
  asks: string[]
  status: TurnStatus
  /** An inline error with a plain next step. */
  error: { message: string; next?: string } | null
  /** Folded to a one-line receipt that reopens. */
  folded: boolean
  /** True when it came from a prepared scene (shown at once, never slowed down to look generated). */
  prepared: boolean
}

export type TurnEvent =
  | { type: "phase"; label: string }
  | { type: "word"; text: string }
  | { type: "block"; block: Block }
  | { type: "asks"; asks: string[] }
  | { type: "done" }
  | { type: "error"; message: string; next?: string }

export type ConversationAction =
  | { type: "ask"; id: string; ask: string; prepared?: boolean }
  | { type: "event"; id: string; event: TurnEvent }
  | { type: "stop"; id: string }
  | { type: "fold"; id: string; folded: boolean }
  /** "Back to the page": folds every turn. */
  | { type: "fold-all" }

export interface Conversation {
  turns: Turn[]
}

/** The most blocks one answer may bring, and the most next asks. */
export const MAX_BLOCKS = 3
export const MAX_ASKS = 3
/** A turn's named phase before the host names one. */
export const DEFAULT_PHASE = "Thinking it over"

export const emptyConversation: Conversation = { turns: [] }

const update = (state: Conversation, id: string, fn: (t: Turn) => Turn): Conversation => ({ turns: state.turns.map((t) => (t.id === id ? fn(t) : t)) })
const open = (t: Turn) => t.status === "thinking" || t.status === "speaking"

export function conversationReducer(state: Conversation, action: ConversationAction): Conversation {
  switch (action.type) {
    case "ask": {
      if (state.turns.some((t) => t.id === action.id)) return state
      // A new ask stops any turn still streaming, so two answers never grow at once. Earlier turns stay open until
      // the visitor folds them.
      const turns = state.turns.map((t) => (open(t) ? { ...t, status: "stopped" as const } : t))
      const turn: Turn = { id: action.id, ask: action.ask.trim(), phase: DEFAULT_PHASE, words: [], blocks: [], asks: [], status: "thinking", error: null, folded: false, prepared: action.prepared === true }
      return { turns: [...turns, turn] }
    }
    case "event":
      return update(state, action.id, (t) => (open(t) ? applyEvent(t, action.event) : t))
    case "stop":
      return update(state, action.id, (t) => (open(t) ? { ...t, status: "stopped" } : t))
    case "fold":
      return update(state, action.id, (t) => (open(t) ? t : { ...t, folded: action.folded }))
    case "fold-all":
      return { turns: state.turns.map((t) => (open(t) ? t : { ...t, folded: true })) }
  }
}

function applyEvent(t: Turn, e: TurnEvent): Turn {
  switch (e.type) {
    case "phase":
      return t.words.length > 0 ? t : { ...t, phase: e.label.trim() || DEFAULT_PHASE }
    case "word": {
      const text = e.text
      if (!text) return t
      return { ...t, status: "speaking", phase: null, words: [...t.words, text] }
    }
    case "block":
      return t.blocks.length >= MAX_BLOCKS ? t : { ...t, status: t.status === "thinking" ? "speaking" : t.status, phase: null, blocks: [...t.blocks, e.block] }
    case "asks":
      return { ...t, asks: e.asks.map((a) => a.trim()).filter(Boolean).slice(0, MAX_ASKS) }
    case "done":
      return { ...t, status: "done", phase: null }
    case "error":
      return { ...t, status: "error", phase: null, error: { message: e.message, ...(e.next ? { next: e.next } : {}) } }
  }
}

/** The spoken line so far. Words arrive with their own spacing ("Acceptto", " is", " the one"). */
export const spokenLine = (t: Turn) => t.words.join("")

/** The one-line receipt a folded turn shows: the ask, and the first block's title or the line's first sentence. */
export function receipt(t: Turn): string {
  const what = t.blocks.find((b) => typeof b.title === "string")?.title ?? spokenLine(t).split(/(?<=[.!?])\s/)[0]
  const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
  return what ? `${short(t.ask, 60)} — ${short(String(what), 80)}` : short(t.ask, 60)
}

/** Whether the composer shows stop (in the send button's place) instead of send. */
export const isStreaming = (c: Conversation) => c.turns.some(open)
