import * as React from "react"
import { staggerStep } from "@aleeforoughi/feather-expression/core"
import { cn } from "../cn"
import { useEnter } from "../hooks"
import type { Block } from "../core/blocks"
import { receipt, type Turn as TurnState } from "../core/conversation"
import type { Speaker } from "../core/disclosure"
import type { Registry } from "../core/registry"

export type BlockRenderer = React.ComponentType<{ block: Block }>

export interface LivingTurnProps extends Omit<React.HTMLAttributes<HTMLElement>, "id" | "children"> {
  turn: TurnState
  /** Who speaks: the byline names them. */
  speaker: Speaker
  /** The brand's block library. A kind it has not designed renders as its statement block. */
  registry: Registry<BlockRenderer>
  /** The visitor chose one of the next asks. */
  onAsk?: (ask: string) => void
  /** Fold to the one-line receipt (folded true), or reopen it (folded false). */
  onFold?: (id: string, folded: boolean) => void
}

function Word({ text, animate }: { text: string; animate: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  useEnter(ref, { enabled: animate, delay: staggerStep("word") })
  return (
    <span ref={ref} data-slot="turn-word" className="motion-reveal">
      {text}
    </span>
  )
}

function Part({ index, animate, children }: { index: number; animate: boolean; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useEnter(ref, { enabled: animate, delay: index * staggerStep("block"), rise: true })
  return (
    <div ref={ref} data-slot="turn-block" className="motion-reveal">
      {children}
    </div>
  )
}

/**
 * LivingTurn: one exchange of the conversation, expanded in place. The visitor's words are a quiet caption, never a
 * bubble; the speaker answers in its own voice, word by word, then brings one to three blocks from the page's own
 * library and the next asks. A finished turn folds to a one-line receipt that reopens.
 */
export function LivingTurn({ turn, speaker, registry, onAsk, onFold, className, ...props }: LivingTurnProps) {
  const askId = `${turn.id}-ask`
  const receiptId = `${turn.id}-receipt`
  const live = turn.status === "thinking" || turn.status === "speaking"
  const animate = turn.status === "speaking" && !turn.prepared
  const blocks = turn.blocks.slice(0, 3)

  if (turn.folded) {
    return (
      <article id={turn.id} data-slot="turn" data-variant="folded" aria-labelledby={receiptId} className={cn("w-full scroll-mt-4", className)} {...props}>
        <button id={receiptId} type="button" data-slot="turn-receipt" aria-expanded={false} onClick={() => onFold?.(turn.id, false)} className="type-caption rounded-control min-h-control focus-ring w-full px-4 text-left text-fg-secondary motion-state">
          {receipt(turn)}
        </button>
      </article>
    )
  }

  return (
    <article id={turn.id} data-slot="turn" data-variant={turn.status} aria-labelledby={askId} aria-busy={live} className={cn("flex w-full flex-col gap-4 py-8 scroll-mt-4", className)} {...props}>
      <p id={askId} data-slot="turn-ask" className="type-caption text-fg-secondary">
        {turn.ask}
      </p>
      <p data-slot="turn-byline" className="type-label text-fg-primary">
        {speaker.name}
      </p>
      <div data-slot="turn-phase" aria-live="polite">
        {turn.phase ? (
          <p data-slot="turn-phase-text" className="type-body text-fg-secondary">
            {turn.phase}
          </p>
        ) : null}
      </div>
      {turn.words.length > 0 ? (
        <p data-slot="turn-line" className="font-voice type-body text-fg-primary">
          {turn.words.map((w, i) => (
            <Word key={i} text={w} animate={animate} />
          ))}
        </p>
      ) : null}
      {blocks.length > 0 ? (
        <div data-slot="turn-blocks" className="flex flex-col gap-8">
          {blocks.map((b, i) => {
            const Render = registry.renderer(b.block)
            return (
              <Part key={b.id ?? i} index={i} animate={animate}>
                <Render block={b} />
              </Part>
            )
          })}
        </div>
      ) : null}
      {turn.error ? (
        <div data-slot="turn-error" role="alert" className="type-body flex flex-col gap-1 text-fg-primary">
          <p data-slot="turn-error-message">{turn.error.message}</p>
          {turn.error.next ? (
            <p data-slot="turn-error-next" className="text-fg-secondary">
              {turn.error.next}
            </p>
          ) : null}
        </div>
      ) : null}
      {turn.asks.length > 0 && !live ? (
        <div data-slot="turn-asks" className="flex flex-wrap gap-2">
          {turn.asks.map((a) => (
            <button key={a} type="button" data-slot="turn-next" onClick={() => onAsk?.(a)} className="type-label rounded-control h-control focus-ring border border-line-secondary px-4 text-fg-primary motion-state">
              {a}
            </button>
          ))}
        </div>
      ) : null}
      {!live ? (
        <button type="button" data-slot="turn-fold" aria-expanded={true} onClick={() => onFold?.(turn.id, true)} className="type-caption rounded-control min-h-control focus-ring self-start px-2 text-fg-secondary motion-state">
          Fold
        </button>
      ) : null}
      <span data-slot="turn-ready" role="status" className="sr-only">
        {turn.status === "done" ? "Answer ready" : ""}
      </span>
    </article>
  )
}
