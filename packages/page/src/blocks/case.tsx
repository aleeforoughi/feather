import { DisplayTitle, MediaFrame, Section, Split } from "@aleeforoughi/feather-expression"
import { mediaProps } from "./media"
import { useRegion, type BlockProps } from "./shared"

/** One piece of work told: the medium beside the words, and the facts as a definition list. */
export function CaseBlock({ block }: BlockProps<"case">) {
  const { id, titleId } = useRegion(block, "Case")
  const text = (
    <div data-slot="case-text" className="flex flex-col gap-6">
      <DisplayTitle as="h2" size="m" id={titleId}>
        {block.title}
      </DisplayTitle>
      {block.body ? (
        <p data-slot="case-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
          {block.body}
        </p>
      ) : null}
      {block.facts && block.facts.length > 0 ? (
        <dl data-slot="case-facts" className="flex flex-col">
          {block.facts.map((fact) => (
            <div key={fact.label} data-slot="case-fact" className="flex flex-col gap-1 border-t border-line-primary py-3 sm:flex-row sm:justify-between sm:gap-6">
              <dt data-slot="case-fact-label" className="type-caps text-fg-secondary">
                {fact.label}
              </dt>
              <dd data-slot="case-fact-value" className="type-body text-fg-primary">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
  return (
    <Section id={id} data-block="case" aria-labelledby={titleId} space="l">
      {block.media ? (
        <Split ratio="7:5">
          <MediaFrame aspect="4/3" {...mediaProps(block.media, block.title)} />
          {text}
        </Split>
      ) : (
        <div data-slot="case-solo" className="col-span-full md:col-span-8">
          {text}
        </div>
      )}
    </Section>
  )
}
