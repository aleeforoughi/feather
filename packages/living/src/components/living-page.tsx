import * as React from "react"
import { createPortal } from "react-dom"
import { prefersReducedMotion } from "@aleeforoughi/feather-expression/core"
import { cn } from "../cn"
import { conversationReducer, emptyConversation, isStreaming, type Turn, type TurnEvent } from "../core/conversation"
import type { Speaker } from "../core/disclosure"
import { anchorScroll, followDecision, sectionInView } from "../core/placement"
import { matchPrepared, preparedEvents, type PreparedScene } from "../core/prepared"
import type { Registry } from "../core/registry"
import { Composer } from "./composer"
import { LivingTurn, type BlockRenderer } from "./turn"

/** What the host's model hook receives with the visitor's words. Abort the signal when the visitor stops. */
export type AskHandler = (ask: string, options: { signal: AbortSignal }) => AsyncIterable<TurnEvent>

export interface UseConversationOptions {
  /** Prepared scenes: a matching ask plays at once, with no model. */
  prepared?: PreparedScene[]
  /** The host's model, as a stream of events. Feather never calls one itself. */
  onAsk?: AskHandler
}

const FAILED = { message: "I couldn't answer that just now.", next: "Try again in a moment, or read the page and write to me directly." }
const OFFLINE = { message: "I'm not answering here right now.", next: "The page has everything I would say; write to me directly with any question." }

/** The conversation as state: asks, streamed events, stop and fold. Turn ids are deterministic (turn-1, turn-2…). */
export function useConversation({ prepared, onAsk }: UseConversationOptions = {}) {
  const [conversation, dispatch] = React.useReducer(conversationReducer, emptyConversation)
  const counter = React.useRef(0)
  const current = React.useRef<{ id: string; controller: AbortController } | null>(null)
  const latest = React.useRef({ prepared, onAsk })
  React.useEffect(() => {
    latest.current = { prepared, onAsk }
  })

  React.useEffect(() => () => current.current?.controller.abort(), [])

  const ask = React.useCallback((text: string): string | null => {
    const words = text.trim()
    if (!words) return null
    current.current?.controller.abort()
    const id = `turn-${++counter.current}`
    const controller = new AbortController()
    current.current = { id, controller }
    const scene = latest.current.prepared ? matchPrepared(latest.current.prepared, words) : null
    dispatch({ type: "ask", id, ask: words, prepared: scene !== null })
    if (scene) {
      for (const event of preparedEvents(scene)) dispatch({ type: "event", id, event })
      return id
    }
    const host = latest.current.onAsk
    if (!host) {
      dispatch({ type: "event", id, event: { type: "error", ...OFFLINE } })
      return id
    }
    void (async () => {
      try {
        for await (const event of host(words, { signal: controller.signal })) {
          if (controller.signal.aborted) return
          dispatch({ type: "event", id, event })
        }
        if (!controller.signal.aborted) dispatch({ type: "event", id, event: { type: "done" } })
      } catch {
        if (!controller.signal.aborted) dispatch({ type: "event", id, event: { type: "error", ...FAILED } })
      }
    })()
    return id
  }, [])

  const stop = React.useCallback(() => {
    const c = current.current
    if (!c) return
    c.controller.abort()
    dispatch({ type: "stop", id: c.id })
  }, [])
  const fold = React.useCallback((id: string, folded = true) => dispatch({ type: "fold", id, folded }), [])
  const foldAll = React.useCallback(() => dispatch({ type: "fold-all" }), [])

  return { conversation, turns: conversation.turns, streaming: isStreaming(conversation), ask, stop, fold, foldAll }
}

/** Lets anything inside the base page ask (a hero's starters, an "ask here" prompt in a section). Null outside a
 * LivingPage, so a block can render its asks only where a conversation exists. */
const AskContext = React.createContext<((ask: string) => void) | null>(null)
export function useLivingAsk(): ((ask: string) => void) | null {
  return React.useContext(AskContext)
}

export interface LivingPageProps extends UseConversationOptions {
  /** The base page: elements with `data-living-section="<id>"`. It stays fully readable with the model off. */
  children: React.ReactNode
  speaker: Speaker
  registry: Registry<BlockRenderer>
  disclosure?: string
  placeholder?: string
  /** Starter asks; defaults to the prepared scenes' asks. */
  starters?: string[]
  /** Height (px) of a fixed header the anchored question sits below. */
  scrollOffset?: number
  className?: string
}

const lastOf = (turns: Turn[]) => turns[turns.length - 1]

/**
 * LivingPage: the whole website, complete before anyone types. The conversation expands it in place, right after the
 * section the reader is in, with blocks from the page's own library, and "Back to the page" folds it all again.
 */
export function LivingPage({ children, speaker, registry, prepared, onAsk, disclosure, placeholder, starters, scrollOffset = 0, className }: LivingPageProps) {
  const { turns, streaming, ask, stop, fold, foldAll } = useConversation({ prepared, onAsk })
  const rootRef = React.useRef<HTMLDivElement>(null)
  const baseRef = React.useRef<HTMLDivElement>(null)
  const [slots, setSlots] = React.useState<Record<string, HTMLElement>>({})
  const [placement, setPlacement] = React.useState<Record<string, string | null>>({})
  const [showJump, setShowJump] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const anchored = React.useRef<string | null>(null)
  const lastBottom = React.useRef<number | null>(null)

  // The slot after each base section, where turns open. Made in the DOM so the host's own markup stays untouched.
  React.useLayoutEffect(() => {
    const base = baseRef.current
    if (!base) return
    const made: HTMLElement[] = []
    const next: Record<string, HTMLElement> = {}
    base.querySelectorAll<HTMLElement>("[data-living-section]").forEach((section) => {
      const slot = document.createElement("div")
      slot.setAttribute("data-slot", "turn-slot")
      slot.setAttribute("data-after", section.dataset.livingSection ?? "")
      section.after(slot)
      made.push(slot)
      next[section.dataset.livingSection ?? ""] = slot
    })
    const tail = document.createElement("div")
    tail.setAttribute("data-slot", "turn-slot")
    tail.setAttribute("data-after", "")
    base.append(tail)
    made.push(tail)
    next[""] = tail
    setSlots(next)
    return () => made.forEach((s) => s.remove())
  }, [])

  const measure = React.useCallback(() => {
    const last = lastOf(turns)
    const el = last ? rootRef.current?.querySelector<HTMLElement>(`[id="${last.id}"]`) : null
    if (!el) return null
    return el.getBoundingClientRect().bottom + window.scrollY
  }, [turns])

  const handleSend = (text: string) => {
    const base = baseRef.current
    const boxes = base
      ? [...base.querySelectorAll<HTMLElement>("[data-living-section]")].map((el) => {
          const r = el.getBoundingClientRect()
          return { id: el.dataset.livingSection ?? "", top: r.top, bottom: r.bottom }
        })
      : []
    const after = sectionInView(boxes, { top: 0, height: window.innerHeight })
    const id = ask(text)
    if (id) {
      anchored.current = id
      setPlacement((p) => ({ ...p, [id]: after }))
    }
  }

  // A new turn: its question anchors at the top. While it grows: follow only if the reader was at the bottom.
  React.useLayoutEffect(() => {
    const last = lastOf(turns)
    if (!last) return
    const el = rootRef.current?.querySelector<HTMLElement>(`[id="${last.id}"]`)
    if (!el) return
    const bottom = el.getBoundingClientRect().bottom + window.scrollY
    if (anchored.current === last.id) {
      anchored.current = null
      const top = el.getBoundingClientRect().top + window.scrollY
      if (typeof window.scrollTo === "function") window.scrollTo({ top: anchorScroll(top, scrollOffset), behavior: prefersReducedMotion(el) ? "auto" : "smooth" })
    } else if (lastBottom.current !== null && bottom > lastBottom.current) {
      const before = { scrollTop: window.scrollY, viewportHeight: window.innerHeight, contentBottom: lastBottom.current }
      if (followDecision(before, streaming).follow && typeof window.scrollTo === "function") window.scrollTo({ top: Math.max(0, bottom - window.innerHeight), behavior: "auto" })
    }
    lastBottom.current = bottom
    const now = { scrollTop: window.scrollY, viewportHeight: window.innerHeight, contentBottom: bottom }
    setShowJump(followDecision(now, streaming).showJump)
  }, [turns, streaming, scrollOffset])

  React.useEffect(() => {
    const onScroll = () => {
      const bottom = measure()
      if (bottom === null) return setShowJump(false)
      setShowJump(followDecision({ scrollTop: window.scrollY, viewportHeight: window.innerHeight, contentBottom: bottom }, streaming).showJump)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [measure, streaming])

  const jump = () => {
    const bottom = measure()
    if (bottom !== null && typeof window.scrollTo === "function") window.scrollTo({ top: Math.max(0, bottom - window.innerHeight), behavior: prefersReducedMotion(rootRef.current) ? "auto" : "smooth" })
  }
  const back = () => {
    foldAll()
    setShowJump(false)
    setMessage("Back at the page")
  }

  const grouped = new Map<string, Turn[]>()
  for (const t of turns) {
    const where = placement[t.id] ?? ""
    const key = where in slots ? where : ""
    grouped.set(key, [...(grouped.get(key) ?? []), t])
  }
  const anyOpen = turns.some((t) => !t.folded)
  const docked = turns.length > 0

  return (
    <div ref={rootRef} data-slot="living-page" className={cn("relative w-full", className)}>
      <div ref={baseRef} data-slot="living-base">
        <AskContext.Provider value={handleSend}>{children}</AskContext.Provider>
      </div>
      {[...grouped.entries()].map(([key, list]) =>
        slots[key]
          ? createPortal(
              <div data-slot="turn-group" className="mx-auto flex w-full max-w-3xl flex-col px-4">
                {list.map((t) => (
                  <LivingTurn key={t.id} turn={t} speaker={speaker} registry={registry} onAsk={handleSend} onFold={fold} />
                ))}
              </div>,
              slots[key],
              key || "end"
            )
          : null
      )}
      <div data-slot="living-dock" data-variant={docked ? "docked" : "inline"} className={cn("z-10 flex w-full flex-col items-center gap-2 px-4 pb-4 pt-2", docked && "overlay-surface sticky bottom-0")}>
        {showJump || anyOpen ? (
          <div data-slot="living-controls" className="flex gap-2">
            {showJump ? (
              <button type="button" data-slot="living-jump" onClick={jump} className="type-label rounded-control h-control focus-ring border border-line-secondary bg-surface-raised px-4 text-fg-primary motion-state">
                Jump to latest
              </button>
            ) : null}
            {anyOpen ? (
              <button type="button" data-slot="living-back" onClick={back} className="type-label rounded-control h-control focus-ring border border-line-secondary bg-surface-raised px-4 text-fg-primary motion-state">
                Back to the page
              </button>
            ) : null}
          </div>
        ) : null}
        <Composer speaker={speaker} disclosure={disclosure} placeholder={placeholder} streaming={streaming} onSend={handleSend} onStop={stop} starters={turns.length === 0 ? (starters ?? prepared?.map((s) => s.ask)) : undefined} />
      </div>
      <div data-slot="living-live" role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
    </div>
  )
}
