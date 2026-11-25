import * as React from "react"
import { Grid, MediaFrame, ScrollLayers, Section, useReducedMotion } from "@aleeforoughi/feather-expression"
import type { WorkItem, WorkVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaProps, mediaSrc } from "./media"
import { BlockTitle, CardBody, join, useCursorLabel, useRegion, type BlockProps } from "./shared"

const toItem = (item: string | WorkItem): WorkItem => (typeof item === "string" ? { id: item, title: item } : item)
const metaOf = (item: WorkItem) => [item.role, item.year].filter(Boolean).join(" · ")

function WorkCard({ item }: { item: WorkItem }) {
  const meta = metaOf(item)
  return (
    <article data-slot="work-item" className="min-w-0">
      <CardBody {...(item.href ? { href: item.href } : {})}>
        {item.media ? <MediaFrame aspect="4/3" {...mediaProps(item.media)} /> : null}
        <div data-slot="work-meta" className="mt-4 flex flex-col gap-2">
          <h3 data-slot="work-title" className="type-title text-fg-primary">
            {item.title}
          </h3>
          {item.summary ? (
            <p data-slot="work-summary" className="max-w-prose type-body-sm text-prose text-fg-secondary">
              {item.summary}
            </p>
          ) : null}
          {meta ? (
            <p data-slot="work-caption" className="type-caption text-fg-secondary">
              {meta}
            </p>
          ) : null}
        </div>
      </CardBody>
    </article>
  )
}

/** A large card for the stack and the rail: the media beside the words on wide screens, on its own raised surface. */
function WorkPanel({ item, wide }: { item: WorkItem; wide: boolean }) {
  const meta = metaOf(item)
  return (
    <article data-slot="work-item" data-variant="panel" className={join("min-w-0 rounded-card border border-line-primary bg-surface-raised p-6", wide ? "" : "w-xs sm:w-sm")}>
      <CardBody {...(item.href ? { href: item.href } : {})}>
        <div data-slot="work-panel" className={join("grid grid-cols-1 gap-6", wide && "lg:grid-cols-12 lg:items-center")}>
          {item.media ? (
            <div data-slot="work-panel-media" className={wide ? "lg:col-span-7" : undefined}>
              <MediaFrame aspect="4/3" {...mediaProps(item.media)} />
            </div>
          ) : null}
          <div data-slot="work-meta" className={join("flex flex-col gap-3", wide && "lg:col-span-5")}>
            {meta ? (
              <p data-slot="work-caption" className="type-caps text-fg-secondary">
                {meta}
              </p>
            ) : null}
            <h3 data-slot="work-title" className={wide ? "type-display-s text-fg-primary" : "type-heading-2 text-fg-primary"}>
              {item.title}
            </h3>
            {item.summary ? (
              <p data-slot="work-summary" className="max-w-prose type-body text-prose text-fg-secondary">
                {item.summary}
              </p>
            ) : null}
          </div>
        </div>
      </CardBody>
    </article>
  )
}

/**
 * hover-list: the work as a typographic index. On a fine pointer the hovered (or focused) item's image floats beside
 * the pointer; on touch each row carries its own thumbnail. The floating image is decoration (the row is the link).
 */
function HoverList({ items }: { items: WorkItem[] }) {
  const cursor = useCursorLabel("view")
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
  const shown = active !== null ? items[active] : undefined
  return (
    <div data-slot="work-hover" className="relative col-span-full">
      <ul ref={list} data-slot="work-list" role="list" className="relative flex flex-col" onPointerLeave={() => setActive(null)}>
        {items.map((item, i) => {
          const meta = metaOf(item)
          const row = (
            <span data-slot="work-row" className="flex min-h-12 items-center gap-6 py-6">
              {item.media ? (
                <span data-slot="work-thumb" className="w-24 shrink-0 pointer-fine:hidden">
                  <MediaFrame aspect="4/3" radius="control" {...mediaProps(item.media)} decorative />
                </span>
              ) : null}
              <span data-slot="work-row-text" className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <h3 data-slot="work-title" className="type-display-s text-fg-primary underline-offset-8 group-hover:underline">
                  {item.title}
                </h3>
                {meta ? (
                  <span data-slot="work-caption" className="type-caption text-fg-secondary">
                    {meta}
                  </span>
                ) : null}
              </span>
            </span>
          )
          return (
            <li key={item.id} data-slot="work-item" data-state={active === i ? "active" : "idle"} className="border-t border-line-primary" onPointerEnter={(e) => { setActive(i); place(e) }} onPointerMove={place} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
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
      </ul>
      <div
        ref={preview}
        data-slot="work-preview"
        data-state={shown?.media ? "shown" : "hidden"}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 z-layer-raised hidden w-xs data-[state=shown]:visible pointer-fine:block"
      >
        {shown?.media ? <img data-slot="work-preview-media" src={mediaSrc(shown.media)} alt="" decoding="async" className="block aspect-4/3 w-full rounded-card object-cover shadow-2" /> : null}
      </div>
    </div>
  )
}

/**
 * Selected work. Variants (feather.page/1): grid (the default, as /0: cards, each one a link when it has an `href`),
 * hover-list (a typographic index with a floating preview), stack (large cards that stack as you scroll; ScrollLayers
 * stack) and rail (a horizontal rail; pinned on a fine pointer, a native snap rail on touch). The moving forms need
 * loudness 2 and rest in reading order under reduced motion.
 */
export function WorkBlock({ block }: BlockProps<"work">) {
  const { id, titleId, labelled } = useRegion(block, "Selected work")
  const knobs = useKnobs<WorkVariant>("work", block, { space: "l" })
  const items = block.items.map(toItem)
  const v = knobs.variant
  const pattern = block.scroll?.pattern
  const stack = v === "stack" || (v === "grid" && pattern === "stack")
  const rail = v === "rail" || (v === "grid" && pattern === "horizontal")
  if (!knobs.any) {
    return (
      <Section id={id} data-block="work" {...labelled} space="l">
        {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
        <Grid columns={items.length === 1 || items.length === 2 || items.length === 4 ? 2 : 3}>
          {items.map((item) => (
            <WorkCard key={item.id} item={item} />
          ))}
        </Grid>
      </Section>
    )
  }
  const title = block.title ? (
    <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
      {block.title}
    </KnobTitle>
  ) : null
  if (rail) {
    return (
      <Section id={id} data-block="work" {...labelled} grid={false} {...knobs.section}>
        {title ? <div data-slot="work-head" className="page-grid">{title}</div> : null}
        <ScrollLayers variant="horizontal" aria-label={block.title ?? "Selected work"} {...(block.scroll?.length ? { length: block.scroll.length } : {})}>
          {items.map((item) => (
            <WorkPanel key={item.id} item={item} wide={false} />
          ))}
        </ScrollLayers>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="work" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
        {stack ? (
          <div data-slot="work-stack" className="col-span-full">
            <ScrollLayers variant="stack" aria-label={block.title ?? "Selected work"}>
              {items.map((item) => (
                <WorkPanel key={item.id} item={item} wide />
              ))}
            </ScrollLayers>
          </div>
        ) : v === "hover-list" ? (
          <HoverList items={items} />
        ) : (
          <Grid columns={knobs.align === "split" ? 2 : items.length === 1 || items.length === 2 || items.length === 4 ? 2 : 3}>
            {items.map((item) => (
              <WorkCard key={item.id} item={item} />
            ))}
          </Grid>
        )}
      </KnobBody>
    </Section>
  )
}
