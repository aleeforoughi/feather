import { Grid, Reel, Section } from "@aleeforoughi/feather-expression"
import type { TestimonialsVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { QuoteCard, quoteKey } from "./quote"
import { useRegion, type BlockProps } from "./shared"

/**
 * Several people's words, each attributed, on quote's own cards (QuoteCard: the words in curly quotes over the name
 * and role). grid (the default): two or three columns; rail: a native snap rail with previous and next.
 */
export function TestimonialsBlock({ block }: BlockProps<"testimonials">) {
  const { id, titleId, labelled } = useRegion(block, "What people say")
  const knobs = useKnobs<TestimonialsVariant>("testimonials", block, { space: "l" })
  const n = block.items.length
  return (
    <Section id={id} data-block="testimonials" {...labelled} {...knobs.section}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <KnobBody knobs={knobs}>
        {knobs.variant === "rail" ? (
          <div data-slot="testimonials-rail" className="col-span-full">
            <Reel aria-label={`${block.title ?? "What people say"}, one quote at a time`} previousLabel="Previous quote" nextLabel="Next quote">
              {block.items.map((q) => (
                <QuoteCard key={quoteKey(q)} q={q} className="w-xs sm:w-sm" />
              ))}
            </Reel>
          </div>
        ) : (
          <Grid data-slot="testimonials-grid" columns={knobs.align === "split" || n === 2 || n === 4 ? 2 : 3}>
            {block.items.map((q) => (
              <QuoteCard key={quoteKey(q)} q={q} />
            ))}
          </Grid>
        )}
      </KnobBody>
    </Section>
  )
}
