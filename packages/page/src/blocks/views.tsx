// The view-mode switch (feather.page/1 `views`, wave 5): grid, list and index views of a collection through a real
// segmented radio group, remembered per page and block. Reusable by any block in VIEW_BLOCKS (work today): the block
// renders its items in the view useViewMode gives it, and places ViewSwitch above them. The view the block names is
// its static form: without script there is no switch, and that view is the one shown.
import * as React from "react"
import { MediaFrame } from "@aleeforoughi/feather-expression"
import type { ViewMode, WorkItem } from "../core/types"
import { Segmented, useStored, type SegmentOption } from "./controls"
import { mediaProps } from "./media"
import { sizesOf } from "./sizes"
import { CardBody, useCursorLabel } from "./shared"

export const VIEW_OPTIONS: readonly SegmentOption<ViewMode>[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
  { value: "index", label: "Index" },
]

/** Where a block's view is remembered: per page (its path) and per block (its id). */
export const viewKey = (block: string) => `feather-view:${typeof location === "undefined" ? "" : location.pathname}#${block}`

/** The view a block shows: its static view on the server and the first frame, then the remembered one (read before
 * paint on a client-rendered page). */
export function useViewMode(block: string, initial: ViewMode): [ViewMode, (v: ViewMode) => void] {
  const parse = React.useCallback((saved: string | null): ViewMode => (saved === "grid" || saved === "list" || saved === "index" ? saved : initial), [initial])
  const [mode, write] = useStored(viewKey(block), initial, parse)
  return [mode, write]
}

/** The switch itself: "View" and three segments, hidden without script. */
export function ViewSwitch({ block, value, onChange }: { block: string; value: ViewMode; onChange: (v: ViewMode) => void }) {
  return <Segmented slot="view-switch" legend="View" name={`${block}-view`} options={VIEW_OPTIONS} value={value} onChange={onChange} className="noscript:hidden" />
}

const metaOf = (item: WorkItem) => [item.role, item.year].filter(Boolean).join(" · ")

/** The list view of work: a row per item, its picture small beside its words. */
export function WorkList({ items }: { items: WorkItem[] }) {
  return (
    <ul data-slot="work-view-list" role="list" className="col-span-full flex flex-col">
      {items.map((item) => (
        <li key={item.id} data-slot="work-item" className="border-t border-line-primary py-6">
          <CardBody {...(item.href ? { href: item.href } : {})}>
            <div data-slot="work-row" className="flex flex-row items-start gap-6">
              {item.media ? (
                <div data-slot="work-thumb" className="w-24 shrink-0 sm:w-32">
                  <MediaFrame aspect="4/3" radius="control" {...mediaProps(item.media, undefined, sizesOf("work.views-list.part"))} />
                </div>
              ) : null}
              <div data-slot="work-meta" className="flex min-w-0 flex-col gap-2">
                <h3 data-slot="work-title" className="type-heading-2 text-fg-primary">
                  {item.title}
                </h3>
                {item.summary ? (
                  <p data-slot="work-summary" className="max-w-prose type-body text-prose text-fg-secondary">
                    {item.summary}
                  </p>
                ) : null}
                {metaOf(item) ? (
                  <p data-slot="work-caption" className="type-caption text-fg-secondary">
                    {metaOf(item)}
                  </p>
                ) : null}
              </div>
            </div>
          </CardBody>
        </li>
      ))}
    </ul>
  )
}

/** The index view of work: names only, set large, with the role and the year in columns. */
export function WorkIndex({ items }: { items: WorkItem[] }) {
  const cursor = useCursorLabel("view")
  return (
    <ol data-slot="work-view-index" role="list" className="col-span-full flex flex-col">
      {items.map((item, i) => {
        const row = (
          <span data-slot="work-index-row" className="grid min-h-12 grid-cols-12 items-baseline gap-x-6 gap-y-1 py-4">
            <span data-slot="work-index-number" aria-hidden="true" className="col-span-2 type-caps numeric text-fg-secondary sm:col-span-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 data-slot="work-title" className="col-span-10 type-heading-1 text-fg-primary underline-offset-8 group-hover:underline sm:col-span-7">
              {item.title}
            </h3>
            <span data-slot="work-index-role" className="col-span-10 col-start-3 type-body-sm text-fg-secondary sm:col-span-3 sm:col-start-auto">
              {item.role}
            </span>
            <span data-slot="work-index-year" className="col-span-10 col-start-3 type-body-sm numeric text-fg-secondary sm:col-span-1 sm:col-start-auto sm:text-end">
              {item.year}
            </span>
          </span>
        )
        return (
          <li key={item.id} data-slot="work-item" className="border-t border-line-primary">
            {item.href ? (
              <a href={item.href} data-slot="work-link" {...cursor} className="group block focus-ring">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        )
      })}
    </ol>
  )
}
