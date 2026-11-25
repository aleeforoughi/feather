import * as React from "react"
import { MediaFrame, Reel, Section, useReducedMotion, type MediaAspect, type MediaTreatment } from "@aleeforoughi/feather-expression"
import { Lightbox, type LightboxImage } from "@aleeforoughi/feather-react"
import type { GalleryItem, GalleryVariant } from "../core/types"
import { HoverIndex, HoverThumb } from "./hover-index"
import { KnobBody, KnobTitle, scrollAllowed, useKnobs } from "./knobs"
import { mediaProps, mediaSrc } from "./media"
import { join, useRegion, type BlockProps } from "./shared"

/** The masonry's rhythm of frames: the column heights fall out of it, and every frame's box is known before it loads. */
const MASONRY: MediaAspect[] = ["4/5", "1/1", "3/4", "4/3", "4/5", "16/9"]
/** The wheel: fewer than this and it is the rail; it shows this many steps either side of the front. */
export const WHEEL_MIN = 3
const WHEEL_NEAR = 3
/** Pointer travel (px) per step of the wheel, and horizontal scroll (deltaX) per step. */
const DRAG_STEP = 72
const SCROLL_STEP = 60

const altOf = (item: GalleryItem) => mediaProps(item.media).alt ?? item.title ?? ""
const nameOf = (item: GalleryItem) => item.title ?? altOf(item)

/**
 * The image as a link to itself, which the script turns into the lightbox: with no script it opens the file, with it
 * the lightbox, at this image. A modified click (a new tab) is the browser's.
 */
function Opener({ item, index, onOpen, className, children, ...rest }: { item: GalleryItem; index: number; onOpen: (i: number) => void; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "onClick" | "href">) {
  return (
    <a
      href={mediaSrc(item.media)}
      data-slot="gallery-open"
      aria-haspopup="dialog"
      className={join("block focus-ring", className)}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        onOpen(index)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

function Caption({ item, className }: { item: GalleryItem; className?: string }) {
  if (!item.title && !item.caption) return null
  return (
    <figcaption data-slot="gallery-caption" className={join("flex flex-col gap-1", className)}>
      {item.title ? (
        <span data-slot="gallery-title" className="type-title text-fg-primary">
          {item.title}
        </span>
      ) : null}
      {item.caption ? (
        <span data-slot="gallery-text" className="type-caption text-fg-secondary">
          {item.caption}
        </span>
      ) : null}
    </figcaption>
  )
}

interface VariantProps {
  items: GalleryItem[]
  onOpen: (i: number) => void
  treatment: MediaTreatment
  label: string
}

function Rail({ items, onOpen, treatment, label, loop }: VariantProps & { loop: boolean }) {
  return (
    <div data-slot="gallery-rail" className="col-span-full">
      <Reel aria-label={label} loop={loop} previousLabel="Previous image" nextLabel="Next image">
        {items.map((item, i) => (
          <figure key={i} data-slot="gallery-item" className="flex w-xs flex-col gap-3 sm:w-sm">
            <Opener item={item} index={i} onOpen={onOpen} className="rounded-card">
              <MediaFrame aspect="4/5" {...mediaProps(item.media)} treatment={treatment} />
            </Opener>
            <Caption item={item} />
          </figure>
        ))}
      </Reel>
    </div>
  )
}

function Masonry({ items, onOpen, treatment }: VariantProps) {
  return (
    <ul data-slot="gallery-masonry" role="list" className="col-span-full columns-1 gap-6 sm:columns-2 lg:columns-3">
      {items.map((item, i) => (
        <li key={i} data-slot="gallery-item" className="mb-6 break-inside-avoid">
          <figure data-slot="gallery-figure" className="flex flex-col gap-3">
            <Opener item={item} index={i} onOpen={onOpen} className="rounded-card">
              <MediaFrame aspect={MASONRY[i % MASONRY.length]} {...mediaProps(item.media)} treatment={treatment} />
            </Opener>
            <Caption item={item} />
          </figure>
        </li>
      ))}
    </ul>
  )
}

/** grid: equal frames; the caption sits on the image's scrim, revealed on hover and on focus with a fine pointer, and
 * always shown on touch, where nothing hovers. */
function GridVariant({ items, onOpen, treatment }: VariantProps) {
  return (
    <ul data-slot="gallery-grid" role="list" className="col-span-full grid grid-cols-2 gap-4 lg:grid-cols-3">
      {items.map((item, i) => (
        <li key={i} data-slot="gallery-item" className="min-w-0">
          <figure data-slot="gallery-figure" className="group relative">
            <Opener item={item} index={i} onOpen={onOpen} className="rounded-card">
              <MediaFrame aspect="1/1" {...mediaProps(item.media)} treatment={treatment} />
            </Opener>
            {item.title || item.caption ? (
              <figcaption
                data-slot="gallery-caption"
                className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-b-card bg-media-scrim p-4 text-ink-on-media motion-state pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
              >
                {item.title ? (
                  <span data-slot="gallery-title" className="type-label">
                    {item.title}
                  </span>
                ) : null}
                {item.caption ? (
                  <span data-slot="gallery-text" className="type-caption">
                    {item.caption}
                  </span>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        </li>
      ))}
    </ul>
  )
}

function HoverListVariant({ items, onOpen }: VariantProps) {
  return (
    <HoverIndex
      slot="gallery"
      entries={items.map((item, i) => ({
        key: String(i),
        media: item.media,
        row: (
          <Opener item={item} index={i} onOpen={onOpen} className="group" aria-label={`${nameOf(item)}, open the image`}>
            <span data-slot="gallery-row" className="flex min-h-12 items-center gap-6 py-6">
              <HoverThumb media={item.media} slot="gallery" />
              <span data-slot="gallery-row-text" className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span data-slot="gallery-name" className="type-display-s text-fg-primary underline-offset-8 group-hover:underline">
                  {nameOf(item)}
                </span>
                {item.caption ? (
                  <span data-slot="gallery-text" className="type-caption text-fg-secondary">
                    {item.caption}
                  </span>
                ) : null}
              </span>
            </span>
          </Opener>
        ),
      }))}
    />
  )
}

/**
 * wheel: the images on a ring, one at the front. Arrow keys on the ring (and Home, End), the previous and next
 * buttons, a horizontal drag or a horizontal scroll each turn it one step; the vertical scroll and pinch-zoom stay the
 * page's. Only the front image is reachable (the rest are hidden from assistive technology and inert), and which one
 * it is is announced. The ring turns on the scene role; it is always round, and Tab leaves it.
 */
function Wheel({ items, onOpen, treatment, label }: VariantProps) {
  const n = items.length
  // A continuous turn count, so stepping past the last image keeps turning the same way.
  const [turn, setTurn] = React.useState(0)
  const active = ((turn % n) + n) % n
  const drag = React.useRef<{ x: number; moved: number } | null>(null)
  const dragged = React.useRef(false)
  const wheel = React.useRef(0)
  const angle = 360 / n
  // The ring's radius, from the frame's width (w-xs, 20rem) and a little air between frames.
  const radius = (10 / Math.tan(Math.PI / n)) * 1.15
  const step = (by: number) => setTurn((t) => t + by)
  const onKey = (e: React.KeyboardEvent) => {
    const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
    if (by) {
      e.preventDefault()
      step(by)
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault()
      setTurn((t) => t - active + (e.key === "End" ? n - 1 : 0))
    }
  }
  return (
    <div data-slot="gallery-wheel" className="col-span-full flex flex-col gap-6">
      <div
        data-slot="gallery-wheel-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={`${label}: use the arrow keys to turn it`}
        tabIndex={0}
        className="relative flex touch-pan-y select-none justify-center overflow-hidden rounded-card py-12 focus-ring"
        style={{ perspective: "75rem" }}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: 0 }
          dragged.current = false
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          d.moved = Math.max(d.moved, Math.abs(dx))
          if (Math.abs(dx) >= DRAG_STEP) {
            step(dx < 0 ? 1 : -1)
            d.x = e.clientX
            dragged.current = true
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={(e) => {
          // A drag that turned the ring is not a click on the image it ended over.
          if (dragged.current) {
            e.preventDefault()
            e.stopPropagation()
            dragged.current = false
          }
        }}
        onWheel={(e) => {
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
          wheel.current += e.deltaX
          if (Math.abs(wheel.current) >= SCROLL_STEP) {
            step(wheel.current > 0 ? 1 : -1)
            wheel.current = 0
          }
        }}
      >
        {/* The front frame's box, in the flow: the stage's height, before any image loads. */}
        <div data-slot="gallery-wheel-size" aria-hidden="true" className="invisible aspect-4/5 w-xs" />
        <ul
          data-slot="gallery-wheel-ring"
          role="list"
          className="absolute inset-y-12 left-1/2 w-xs -translate-x-1/2 motion-scene"
          style={{ transformStyle: "preserve-3d", transform: `translateZ(${-radius}rem) rotateY(${-turn * angle}deg)` }}
        >
          {items.map((item, i) => {
            const distance = Math.min(Math.abs(i - active), n - Math.abs(i - active))
            const front = i === active
            return (
              <li
                key={i}
                data-slot="gallery-item"
                data-state={front ? "active" : distance <= WHEEL_NEAR ? "near" : "far"}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}`}
                aria-hidden={front ? undefined : true}
                inert={front ? undefined : true}
                className="absolute inset-0 motion-scene data-[state=far]:opacity-0 data-[state=near]:opacity-muted"
                style={{ transform: `rotateY(${i * angle}deg) translateZ(${radius}rem)`, backfaceVisibility: "hidden" }}
              >
                <Opener item={item} index={i} onOpen={onOpen} className="h-full rounded-card" draggable={false}>
                  <MediaFrame aspect="4/5" {...mediaProps(item.media)} treatment={treatment} />
                </Opener>
              </li>
            )
          })}
        </ul>
      </div>
      <div data-slot="gallery-wheel-bar" className="flex flex-wrap items-center justify-between gap-4">
        <p data-slot="gallery-wheel-status" aria-live="polite" className="type-caption text-fg-secondary">
          {`${active + 1} of ${n}: ${nameOf(items[active])}`}
        </p>
        <div data-slot="gallery-wheel-controls" className="flex gap-2">
          <button type="button" data-slot="gallery-wheel-previous" className={WHEEL_BUTTON} onClick={() => step(-1)}>
            Previous image
          </button>
          <button type="button" data-slot="gallery-wheel-next" className={WHEEL_BUTTON} onClick={() => step(1)}>
            Next image
          </button>
        </div>
      </div>
    </div>
  )
}

const WHEEL_BUTTON =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-control border border-line-primary bg-surface-base px-3 type-label text-fg-primary focus-ring not-disabled:hover:bg-surface-hover motion-hover-out"

/**
 * Images to look through, each opening large in feather-react's Lightbox (Previous, Next and the arrow keys step
 * through all of them; Escape closes and focus returns). Every image is a real link to its file first, so with no
 * script it still opens. Variants (feather.page/1):
 * - rail (the default): a native snap rail with previous and next, scrolled by the keyboard too; `loop` makes it
 *   endless (copies on each side, hidden and inert, and Tab still leaves it);
 * - masonry: columns of frames in a set rhythm of aspects;
 * - grid: equal frames, the caption revealed on hover and on focus (always shown on touch);
 * - hover-list: the names as an index whose picture follows hover and focus (a list with thumbnails on touch);
 * - wheel: a ring turned one step at a time by drag, horizontal scroll or the arrow keys, at loudness 2 or more,
 *   with motion allowed and three images or more; otherwise it is the rail.
 */
export function GalleryBlock({ block }: BlockProps<"gallery">) {
  const { id, titleId, labelled } = useRegion(block, "Gallery")
  const knobs = useKnobs<GalleryVariant>("gallery", block, { space: "l" })
  const box = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion(box)
  const [open, setOpen] = React.useState<number | null>(null)
  // The wheel is decided after mount (the server and the first render draw the rail, its static form).
  const [wheel, setWheel] = React.useState(false)
  React.useEffect(() => setWheel(knobs.variant === "wheel" && !reduced && block.items.length >= WHEEL_MIN && scrollAllowed(box.current)), [knobs.variant, reduced, block.items.length])
  const images: LightboxImage[] = block.items.map((item) => ({ src: mediaSrc(item.media), alt: altOf(item), ...(item.caption || item.title ? { caption: item.caption ?? item.title } : {}) }))
  const label = block.title ?? "Gallery"
  const props: VariantProps = { items: block.items, onOpen: setOpen, treatment: knobs.treatment, label }
  const v = knobs.variant === "wheel" && !wheel ? "rail" : knobs.variant
  return (
    <Section id={id} data-block="gallery" {...labelled} {...knobs.section} {...(knobs.variant === "wheel" ? { "data-state": wheel ? "wheel" : "rail" } : {})}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <KnobBody knobs={knobs}>
        {block.body ? (
          <p data-slot="gallery-body" className="col-span-full -mt-6 mb-12 max-w-prose type-body-lg text-prose text-fg-secondary">
            {block.body}
          </p>
        ) : null}
        <div ref={box} data-slot="gallery" data-variant={v} className="col-span-full">
          {v === "masonry" ? <Masonry {...props} /> : v === "grid" ? <GridVariant {...props} /> : v === "hover-list" ? <HoverListVariant {...props} /> : v === "wheel" ? <Wheel {...props} /> : <Rail {...props} loop={block.loop === true} />}
        </div>
      </KnobBody>
      <Lightbox images={images} index={open} onIndexChange={setOpen} download={false} previousLabel="Previous image" nextLabel="Next image" />
    </Section>
  )
}
