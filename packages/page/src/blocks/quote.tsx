import { Reel, Section } from "@aleeforoughi/feather-expression"
import type { QuoteItem, QuoteVariant } from "../core/types"
import { alignClass, useKnobs } from "./knobs"
import { join, useRegion, type BlockProps } from "./shared"

const SIZE = { s: "type-display-s", m: "type-display-m", l: "type-display-l", xl: "type-display-xl" } as const

function By({ q, centre = false }: { q: QuoteItem; centre?: boolean }) {
  return (
    <figcaption data-slot="quote-by" className={join("flex flex-col gap-1", centre && "items-center")}>
      <span data-slot="quote-name" className="type-title text-fg-primary">
        {q.by}
      </span>
      {q.role ? (
        <span data-slot="quote-role" className="type-caption text-fg-secondary">
          {q.role}
        </span>
      ) : null}
    </figcaption>
  )
}

/**
 * Someone else's words, attributed, in curly quotes. Variants (feather.page/1): large (the default, as /0), rail (this
 * quote and `items`, more voices, on a native snap rail with previous and next) and pull (a pull quote set off-axis,
 * its opening mark hung large in the margin).
 */
export function QuoteBlock({ block }: BlockProps<"quote">) {
  const { id, labelled } = useRegion(block, "Quote")
  const knobs = useKnobs<QuoteVariant>("quote", block, { space: "l" })
  const main: QuoteItem = { text: block.text, by: block.by, ...(block.role ? { role: block.role } : {}) }

  if (knobs.variant === "rail") {
    const all = [main, ...(block.items ?? [])]
    return (
      <Section id={id} data-block="quote" {...labelled} {...knobs.section}>
        <div data-slot="quote-rail" className="col-span-full">
          <Reel aria-label={block.title ?? "What people say"}>
            {all.map((q) => (
              <figure key={`${q.by}-${q.text.slice(0, 24)}`} data-slot="quote" data-variant="card" className="flex h-full w-xs flex-col justify-between gap-8 rounded-card border border-line-primary bg-surface-raised p-6 sm:w-sm">
                <blockquote data-slot="quote-text">
                  <p className="type-heading-2 text-fg-primary" data-slot="quote-body">{`“${q.text}”`}</p>
                </blockquote>
                <By q={q} />
              </figure>
            ))}
          </Reel>
        </div>
      </Section>
    )
  }
  if (knobs.variant === "pull") {
    return (
      <Section id={id} data-block="quote" {...labelled} {...knobs.section}>
        <figure data-slot="quote" data-variant="pull" className="col-span-full grid grid-cols-4 gap-6 sm:grid-cols-8 lg:grid-cols-12">
          <p data-slot="quote-mark" aria-hidden="true" className="col-span-1 type-display-xl text-fg-secondary lg:col-span-2 lg:col-start-2">
            “
          </p>
          <div data-slot="quote-pull" className="col-span-3 flex flex-col gap-8 sm:col-span-6 lg:col-span-8">
            <blockquote data-slot="quote-text">
              <p className={`${SIZE[knobs.scale ?? "m"]} text-fg-primary`} data-slot="quote-body">{`${block.text}”`}</p>
            </blockquote>
            <By q={main} />
          </div>
        </figure>
      </Section>
    )
  }
  const centre = knobs.align === "center"
  return (
    <Section id={id} data-block="quote" {...labelled} {...knobs.section}>
      <figure data-slot="quote" className={join(alignClass(knobs.align, "col-span-full flex max-w-3xl flex-col gap-8"), knobs.align !== "start" && "flex flex-col gap-8")}>
        <blockquote data-slot="quote-text">
          <p className={knobs.scale ? `${SIZE[knobs.scale]} text-fg-primary` : "type-display-s text-fg-primary"} data-slot="quote-body">{`“${block.text}”`}</p>
        </blockquote>
        <By q={main} centre={centre} />
      </figure>
    </Section>
  )
}
