import { Section } from "@aleeforoughi/feather-expression"
import { useRegion, type BlockProps } from "./shared"

/** Someone else's words, attributed, in curly quotes. */
export function QuoteBlock({ block }: BlockProps<"quote">) {
  const { id, labelled } = useRegion(block, "Quote")
  return (
    <Section id={id} data-block="quote" {...labelled} space="l">
      <figure data-slot="quote" className="col-span-full flex max-w-3xl flex-col gap-8">
        <blockquote data-slot="quote-text">
          <p className="type-display-s text-fg-primary" data-slot="quote-body">{`“${block.text}”`}</p>
        </blockquote>
        <figcaption data-slot="quote-by" className="flex flex-col gap-1">
          <span data-slot="quote-name" className="type-title text-fg-primary">
            {block.by}
          </span>
          {block.role ? (
            <span data-slot="quote-role" className="type-caption text-fg-secondary">
              {block.role}
            </span>
          ) : null}
        </figcaption>
      </figure>
    </Section>
  )
}
