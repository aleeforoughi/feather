import { Section } from "@aleeforoughi/feather-expression"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

/** Questions people actually ask, in native details and summary: keyboard and screen readers work with no script. */
export function FaqBlock({ block }: BlockProps<"faq">) {
  const { id, titleId, labelled } = useRegion(block, "Questions")
  const knobs = useKnobs<"list">("faq", block, { space: "l" })
  const title = !block.title ? null : knobs.any ? (
    <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
      {block.title}
    </KnobTitle>
  ) : (
    <BlockTitle id={titleId}>{block.title}</BlockTitle>
  )
  return (
    <Section id={id} data-block="faq" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
      <div data-slot="faq" className="col-span-full flex max-w-3xl flex-col">
        {block.items.map((item) => (
          <details key={item.q} data-slot="faq-item" className="border-t border-line-primary py-4">
            <summary data-slot="faq-question" className="flex min-h-12 items-center type-title text-fg-primary focus-ring">
              {item.q}
            </summary>
            <p data-slot="faq-answer" className="max-w-prose pb-2 pt-2 type-body text-prose text-fg-secondary">
              {item.a}
            </p>
          </details>
        ))}
      </div>
      </KnobBody>
    </Section>
  )
}
