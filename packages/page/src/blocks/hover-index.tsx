// A typographic index whose hovered (or focused) entry shows its picture beside the pointer: work's hover-list and the
// gallery's. On a fine pointer the preview floats beside the pointer (row-aligned under reduced motion); on touch it
// never shows and each row carries its own thumbnail (HoverThumb). The preview is decoration: the row is the act.
import * as React from "react"
import { MediaFrame, useReducedMotion } from "@aleeforoughi/feather-expression"
import type { Media } from "../core/types"
import { mediaProps, mediaSrc } from "./media"

export interface HoverIndexEntry {
  key: string
  media?: Media
  /** The row: a link or a button around its words (and its HoverThumb). */
  row: React.ReactNode
}

/** The thumbnail a row shows on touch (and never on a fine pointer, where the preview follows instead). */
export function HoverThumb({ media, slot }: { media: Media; slot: string }) {
  return (
    <span data-slot={`${slot}-thumb`} className="w-24 shrink-0 pointer-fine:hidden">
      <MediaFrame aspect="4/3" radius="control" {...mediaProps(media)} decorative />
    </span>
  )
}

/** The list and its floating preview. `slot` prefixes every data-slot (work, gallery). */
export function HoverIndex({ entries, slot }: { entries: HoverIndexEntry[]; slot: string }) {
  const list = React.useRef<HTMLUListElement>(null)
  const preview = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion(list)
  const [active, setActive] = React.useState<number | null>(null)
  const place = (event: React.PointerEvent<HTMLElement>) => {
    const box = list.current?.getBoundingClientRect()
    const el = preview.current
    if (!box || !el || event.pointerType !== "mouse") return
    // Beside the pointer, never over the row's text start; still (row-aligned) under reduced motion.
    const x = reduced ? box.width * 0.62 : Math.min(box.width - el.offsetWidth, Math.max(box.width * 0.45, event.clientX - box.left + 32))
    const y = event.clientY - box.top - el.offsetHeight / 2
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(reduced ? (event.currentTarget.offsetTop + event.currentTarget.offsetHeight / 2 - el.offsetHeight / 2) : y)}px, 0)`
  }
  const shown = active !== null ? entries[active] : undefined
  return (
    <div data-slot={`${slot}-hover`} className="relative col-span-full">
      <ul ref={list} data-slot={`${slot}-list`} role="list" className="relative flex flex-col" onPointerLeave={() => setActive(null)}>
        {entries.map((entry, i) => (
          <li
            key={entry.key}
            data-slot={`${slot}-item`}
            data-state={active === i ? "active" : "idle"}
            className="border-t border-line-primary"
            onPointerEnter={(e) => {
              setActive(i)
              place(e)
            }}
            onPointerMove={place}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {entry.row}
          </li>
        ))}
      </ul>
      <div
        ref={preview}
        data-slot={`${slot}-preview`}
        data-state={shown?.media ? "shown" : "hidden"}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 z-layer-raised hidden w-xs data-[state=shown]:visible pointer-fine:block"
      >
        {shown?.media ? <img data-slot={`${slot}-preview-media`} src={mediaSrc(shown.media)} alt="" decoding="async" className="block aspect-4/3 w-full rounded-card object-cover shadow-2" /> : null}
      </div>
    </div>
  )
}
