import * as React from "react"
import { FitText, fitStyle } from "@aleeforoughi/feather-expression"
import type { BlockName, PageBlock } from "../core/types"

/** One block of kind `K`, narrowed out of the document's block union. */
export type BlockOf<K extends BlockName> = Extract<PageBlock, { block: K }>

export interface BlockProps<K extends BlockName> {
  block: BlockOf<K>
  /** The block holds the page's LCP element: its media loads eagerly. The hero is priority unless told otherwise. */
  priority?: boolean
  /** Called with a starter's text when the visitor picks it. Without it (the model is off) starters are not shown. */
  onAsk?: (starter: string) => void
}

/** Joins class names, dropping empty ones. */
export const join = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(" ")

/**
 * A block is a labelled region. With a title, the region is named by its heading (`aria-labelledby`); without one it
 * is named by `label`. The heading id comes from `block.id` (or a generated one for blocks with none).
 */
export function useRegion(block: { id?: string; title?: string }, label: string) {
  const generated = React.useId().replace(/:/g, "")
  const titleId = `${block.id ?? generated}-title`
  const labelled = block.title ? { "aria-labelledby": titleId } : { "aria-label": label }
  return { id: block.id, titleId, labelled }
}

/** A block's own heading: `h2`, in the heading role. */
export function BlockTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} data-slot="block-title" className="col-span-full mb-12 type-heading-1 text-fg-primary" style={fitStyle(children)}>
      <FitText>{children}</FitText>
    </h2>
  )
}

/** Controls are 48px tall (44px hit area at least). The first act of a block is primary; the rest are quiet. */
export const BUTTON_PRIMARY =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control bg-primary px-6 type-label text-primary-foreground focus-ring"
/** A starter as a chip (feather.page/1): the living composer's own suggestion style, a secondary row that never
 * competes with the section's one filled action; at least 48px tall, whatever the density. */
export const CHIP =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-line-secondary bg-surface-base px-4 type-label text-fg-primary focus-ring not-disabled:hover:bg-surface-hover motion-hover-out"
export const BUTTON_QUIET =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-line-primary bg-surface-base px-6 type-label text-fg-primary focus-ring not-disabled:hover:bg-surface-hover motion-hover-out"

/** Which of a section's actions is its one filled action: the one marked `primary: true`; else the first, unless any
 * says `primary: false` of itself and none is marked (then none). -1 when the section leads with something else. */
export function filledAction(actions: readonly { primary?: boolean }[], lead = true): number {
  if (!lead) return -1
  const marked = actions.findIndex((a) => a.primary === true)
  if (marked !== -1) return marked
  return actions.some((a) => a.primary !== undefined) ? -1 : 0
}

/** Whether the page runs the pointer follower (`cursor: "follower"`): blocks then label their links for it
 * (`data-cursor="view"`). Off by default, so a page without it renders exactly as before. */
export const CursorLabels = React.createContext(false)

/** The `data-cursor` attribute a link takes when the follower runs. */
export function useCursorLabel(kind: "view" | "drag" | "play" | "link" = "view"): { "data-cursor"?: string } {
  return React.useContext(CursorLabels) ? { "data-cursor": kind } : {}
}

/** A link or a plain wrapper around a card: the whole card is the link when it has an `href`. */
export function CardBody({ href, children }: { href?: string; children: React.ReactNode }) {
  const cursor = useCursorLabel("view")
  if (!href) {
    return (
      <div data-slot="card-body" className="flex h-full flex-col">
        {children}
      </div>
    )
  }
  return (
    <a href={href} data-slot="card-link" {...cursor} className="group flex h-full flex-col rounded-card focus-ring">
      {children}
    </a>
  )
}
