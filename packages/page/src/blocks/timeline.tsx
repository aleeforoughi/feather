import { Section } from "@aleeforoughi/feather-expression"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

/** Moments in order: an ordered list, the time on the left and what happened on the right. */
export function TimelineBlock({ block }: BlockProps<"timeline">) {
  const { id, titleId, labelled } = useRegion(block, "Timeline")
  return (
    <Section id={id} data-block="timeline" {...labelled} space="l">
      {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
      <ol data-slot="timeline" role="list" className="col-span-full flex flex-col">
        {block.items.map((item) => (
          <li key={`${item.when}-${item.what}`} data-slot="timeline-item" className="grid grid-cols-1 gap-2 border-t border-line-primary py-6 md:grid-cols-12 md:gap-8">
            <p data-slot="timeline-when" className="type-caps text-fg-secondary md:col-span-3">
              {item.when}
            </p>
            <p data-slot="timeline-what" className="type-body-lg text-prose text-fg-primary md:col-span-9">
              {item.what}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
