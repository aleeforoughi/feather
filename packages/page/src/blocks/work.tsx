import { Bento, BentoCell, Grid, MediaFrame, ScrollLayers, Section, type MediaTreatment } from "@aleeforoughi/feather-expression"
import type { WorkItem, WorkVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { HoverIndex, HoverThumb } from "./hover-index"
import { ON_MEDIA, mediaProps } from "./media"
import { sizesOf } from "./sizes"
import { BlockTitle, CardBody, join, useCursorLabel, useRegion, type BlockProps } from "./shared"

const toItem = (item: string | WorkItem): WorkItem => (typeof item === "string" ? { id: item, title: item } : item)
const metaOf = (item: WorkItem) => [item.role, item.year].filter(Boolean).join(" · ")

function WorkCard({ item, treatment = "clean", sizes }: { item: WorkItem; treatment?: MediaTreatment; sizes?: string }) {
  const meta = metaOf(item)
  return (
    <article data-slot="work-item" className="min-w-0">
      <CardBody {...(item.href ? { href: item.href } : {})}>
        {item.media ? <MediaFrame aspect="4/3" {...mediaProps(item.media, undefined, sizes)} treatment={treatment} /> : null}
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
function WorkPanel({ item, wide, treatment }: { item: WorkItem; wide: boolean; treatment: MediaTreatment }) {
  const meta = metaOf(item)
  return (
    <article data-slot="work-item" data-variant="panel" className={join("min-w-0 rounded-card border border-line-primary bg-surface-raised p-6", wide ? "" : "w-xs sm:w-sm")}>
      <CardBody {...(item.href ? { href: item.href } : {})}>
        <div data-slot="work-panel" className={join("grid grid-cols-1 gap-6", wide && "lg:grid-cols-12 lg:items-center")}>
          {item.media ? (
            <div data-slot="work-panel-media" className={wide ? "lg:col-span-7" : undefined}>
              <MediaFrame aspect="4/3" {...mediaProps(item.media, undefined, sizesOf(wide ? "work.stack" : "work.rail"))} treatment={treatment} />
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
 * hover-list: the work as a typographic index (HoverIndex). On a fine pointer the hovered (or focused) item's image
 * floats beside the pointer; on touch each row carries its own thumbnail. The floating image is decoration (the row is
 * the link).
 */
function HoverList({ items }: { items: WorkItem[] }) {
  const cursor = useCursorLabel("view")
  return (
    <HoverIndex
      slot="work"
      entries={items.map((item) => {
        const meta = metaOf(item)
        const row = (
          <span data-slot="work-row" className="flex min-h-12 items-center gap-6 py-6">
            {item.media ? <HoverThumb media={item.media} slot="work" /> : null}
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
        return {
          key: item.id,
          ...(item.media ? { media: item.media } : {}),
          row: item.href ? (
            <a href={item.href} data-slot="work-link" {...cursor} className="group block focus-ring">
              {row}
            </a>
          ) : (
            row
          ),
        }
      })}
    />
  )
}

/**
 * fullscreen-cases: each piece of work a full screen of its own, its picture full bleed under the media scrim and its
 * words on it (the scrim holds the ink at 4.5:1); an item without a picture is the scrim's own ground. The whole case
 * is the link when it has one.
 */
function FullscreenCase({ item, treatment }: { item: WorkItem; treatment: MediaTreatment }) {
  const meta = metaOf(item)
  const body = (
    <div data-slot="work-case-body" className="page-grid relative z-layer-raised w-full pb-16 pt-32">
      <div data-slot="work-meta" className="col-span-full flex flex-col gap-4 lg:col-span-8">
        {meta ? (
          <p data-slot="work-caption" className="type-caps text-fg-secondary">
            {meta}
          </p>
        ) : null}
        <h3 data-slot="work-title" className="type-display-m text-fg-primary text-balance">
          {item.title}
        </h3>
        {item.summary ? (
          <p data-slot="work-summary" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {item.summary}
          </p>
        ) : null}
      </div>
    </div>
  )
  return (
    <article data-slot="work-item" data-variant="case" className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden text-ink-on-media media-placeholder-scrim" style={ON_MEDIA}>
      {item.media ? <MediaFrame aspect="16/9" radius="none" placeholder="scrim" {...mediaProps(item.media, undefined, sizesOf("work.fullscreen-cases"))} treatment={treatment} className="absolute! inset-0 h-full" style={{ aspectRatio: "auto" }} /> : null}
      <div data-slot="work-case-scrim" aria-hidden="true" className="absolute inset-0 bg-media-scrim" />
      {item.href ? (
        <a href={item.href} data-slot="work-link" className="group relative flex min-h-svh flex-col justify-end focus-ring">
          {body}
        </a>
      ) : (
        body
      )}
    </article>
  )
}

/** The bento's rhythm: the first piece leads (two thirds, two rows), then halves and thirds. */
const BENTO: { span: number; rows: number }[] = [
  { span: 8, rows: 2 },
  { span: 4, rows: 1 },
  { span: 4, rows: 1 },
  { span: 6, rows: 1 },
  { span: 6, rows: 1 },
  { span: 4, rows: 1 },
  { span: 4, rows: 1 },
  { span: 4, rows: 1 },
]
function bentoCell(i: number, n: number): { span: number; rows: number } {
  if (n === 1) return { span: 12, rows: 1 }
  if (n === 2) return { span: 6, rows: 1 }
  return BENTO[i < BENTO.length ? i : 3 + ((i - 3) % 5)]
}

/** The sizes place of a bento cell, by its span of 12. */
const bentoPlace = (cell: { span: number; rows: number }) => (cell.rows > 1 ? "work.bento.lead" : cell.span >= 12 ? "work.bento.full" : cell.span >= 6 ? "work.bento.half" : "work.bento.third")

/** bento: the work as a mosaic (expression's Bento), the first piece leading. */
function WorkBento({ items, treatment }: { items: WorkItem[]; treatment: MediaTreatment }) {
  return (
    <Bento data-slot="work-bento">
      {items.map((item, i) => {
        const cell = bentoCell(i, items.length)
        const meta = metaOf(item)
        const lead = cell.rows > 1
        return (
          <BentoCell key={item.id} span={cell.span} rowSpan={cell.rows}>
            <article data-slot="work-item" data-variant={lead ? "lead" : "cell"} className="h-full min-w-0">
              <CardBody {...(item.href ? { href: item.href } : {})}>
                <div data-slot="work-cell" className="flex h-full flex-col gap-4">
                  {item.media ? <MediaFrame aspect={lead ? "4/3" : "16/9"} {...mediaProps(item.media, undefined, sizesOf(bentoPlace(cell)))} treatment={treatment} /> : null}
                  <div data-slot="work-meta" className="mt-auto flex flex-col gap-2">
                    <h3 data-slot="work-title" className={lead ? "type-heading-1 text-fg-primary" : "type-title text-fg-primary"}>
                      {item.title}
                    </h3>
                    {item.summary && lead ? (
                      <p data-slot="work-summary" className="max-w-prose type-body text-prose text-fg-secondary">
                        {item.summary}
                      </p>
                    ) : null}
                    {meta ? (
                      <p data-slot="work-caption" className="type-caption text-fg-secondary">
                        {meta}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardBody>
            </article>
          </BentoCell>
        )
      })}
    </Bento>
  )
}

/**
 * Selected work. Variants (feather.page/1): grid (the default, as /0: cards, each one a link when it has an `href`),
 * hover-list (a typographic index with a floating preview), stack (large cards that stack as you scroll; ScrollLayers
 * stack), rail (a horizontal rail; pinned on a fine pointer, a native snap rail on touch), fullscreen-cases (each piece
 * a full screen, its picture bleeding under the scrim) and bento (a mosaic, the first piece leading). The moving forms
 * need loudness 2 and rest in reading order under reduced motion. `treatment` reaches every picture.
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
            <WorkCard key={item.id} item={item} sizes={sizesOf(items.length === 1 || items.length === 2 || items.length === 4 ? "work.grid.2" : "work.grid.3")} />
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
  const columns = knobs.align === "split" ? 2 : items.length === 1 || items.length === 2 || items.length === 4 ? 2 : 3
  if (v === "fullscreen-cases") {
    return (
      <Section id={id} data-block="work" {...labelled} grid={false} {...knobs.section}>
        {title ? <div data-slot="work-head" className="page-grid pb-12">{title}</div> : null}
        <div data-slot="work-cases" className="flex flex-col">
          {items.map((item) => (
            <FullscreenCase key={item.id} item={item} treatment={knobs.treatment} />
          ))}
        </div>
      </Section>
    )
  }
  if (rail) {
    return (
      <Section id={id} data-block="work" {...labelled} grid={false} {...knobs.section}>
        {title ? <div data-slot="work-head" className="page-grid">{title}</div> : null}
        <ScrollLayers variant="horizontal" aria-label={`${block.title ?? "Selected work"}, one at a time`} {...(block.scroll?.length ? { length: block.scroll.length } : {})}>
          {items.map((item) => (
            <WorkPanel key={item.id} item={item} wide={false} treatment={knobs.treatment} />
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
            <ScrollLayers variant="stack">
              {items.map((item) => (
                <WorkPanel key={item.id} item={item} wide treatment={knobs.treatment} />
              ))}
            </ScrollLayers>
          </div>
        ) : v === "hover-list" ? (
          <HoverList items={items} />
        ) : v === "bento" ? (
          <WorkBento items={items} treatment={knobs.treatment} />
        ) : (
          <Grid columns={columns}>
            {items.map((item) => (
              <WorkCard key={item.id} item={item} treatment={knobs.treatment} sizes={sizesOf(columns === 2 ? "work.grid.2" : "work.grid.3")} />
            ))}
          </Grid>
        )}
      </KnobBody>
    </Section>
  )
}
