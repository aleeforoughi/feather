import { FitText, Reel, Section, fitStyle } from "@aleeforoughi/feather-expression"
import type { TimelineVariant } from "../core/types"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

/**
 * Moments in order. Variants (feather.page/1): list (the default, as /0: an ordered list, the time on the left and
 * what happened on the right) and horizontal (the moments along a native snap rail, read left to right, with previous
 * and next; it never moves on its own).
 */
export function TimelineBlock({ block }: BlockProps<"timeline">) {
  const { id, titleId, labelled } = useRegion(block, "Timeline")
  const knobs = useKnobs<TimelineVariant>("timeline", block, { space: "l" })
  const list = (
    <ol data-slot="timeline" role="list" className="col-span-full flex flex-col">
      {block.items.map((item) => (
        <li key={`${item.when}-${item.what}`} data-slot="timeline-item" className="grid grid-cols-1 gap-2 border-t border-line-primary py-6 md:grid-cols-12 md:gap-8">
          <p data-slot="timeline-when" className="type-caps text-fg-secondary md:col-span-3">
            <FitText>{item.when}</FitText>
          </p>
          <p data-slot="timeline-what" className="type-body-lg text-prose text-fg-primary md:col-span-9">
            {item.what}
          </p>
        </li>
      ))}
    </ol>
  )
  if (!knobs.any) {
    return (
      <Section id={id} data-block="timeline" {...labelled} space="l">
        {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
        {list}
      </Section>
    )
  }
  return (
    <Section id={id} data-block="timeline" {...labelled} {...knobs.section}>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      <KnobBody knobs={knobs}>
        {knobs.variant === "horizontal" ? (
          <div data-slot="timeline" data-variant="horizontal" className="col-span-full">
            <Reel aria-label={`${block.title ?? "Timeline"}, moment by moment`}>
              {block.items.map((item, i) => (
                <div key={`${item.when}-${item.what}`} data-slot="timeline-item" aria-roledescription="moment" aria-label={`${i + 1} of ${block.items.length}`} className="flex w-2xs flex-col gap-4 border-t border-line-primary pt-6 sm:w-xs">
                  <p data-slot="timeline-when" className="type-display-s numeric text-fg-primary" style={fitStyle(item.when)}>
                    <FitText>{item.when}</FitText>
                  </p>
                  <p data-slot="timeline-what" className="type-body-lg text-prose text-fg-secondary">
                    {item.what}
                  </p>
                </div>
              ))}
            </Reel>
          </div>
        ) : (
          list
        )}
      </KnobBody>
    </Section>
  )
}
