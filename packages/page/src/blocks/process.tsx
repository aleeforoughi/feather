import { DisplayTitle, Section, Stage } from "@aleeforoughi/feather-expression"
import type { ProcessVariant } from "../core/types"
import { KnobBody, KnobTitle, sizeOf, useKnobs } from "./knobs"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

const num = (i: number) => String(i + 1).padStart(2, "0")

/**
 * How the work is done. Variants (feather.page/1): list (the default, as /0: numbered steps in an ordered list; the
 * visible number is decoration, the list counts), pinned (the steps scroll past a pinned display numeral; Stage with
 * steps, which needs loudness 2 and stacks in reading order otherwise; scroll.length and snap tune it) and rows (each
 * step a full-width row, its numeral set large beside it).
 */
export function ProcessBlock({ block }: BlockProps<"process">) {
  const { id, titleId, labelled } = useRegion(block, "Process")
  const knobs = useKnobs<ProcessVariant>("process", block, { space: "l" })
  const pinned = knobs.variant === "pinned" || block.scroll?.pattern === "pin"
  if (!knobs.any) {
    return (
      <Section id={id} data-block="process" {...labelled} space="l">
        {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
        <ol data-slot="process" role="list" className="col-span-full grid grid-cols-1 gap-8 md:grid-cols-3">
          {block.steps.map((step, i) => (
            <li key={step.title} data-slot="process-step" className="flex flex-col gap-3 border-t border-line-primary pt-4">
              <p data-slot="process-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
                {num(i)}
              </p>
              <h3 data-slot="process-title" className="type-title text-fg-primary">
                {step.title}
              </h3>
              {step.body ? (
                <p data-slot="process-body" className="max-w-prose type-body text-prose text-fg-secondary">
                  {step.body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>
    )
  }
  if (pinned) {
    return (
      <Section id={id} data-block="process" {...labelled} grid={false} {...knobs.section}>
        <Stage
          title={
            block.title ? (
              <DisplayTitle as="h2" size={sizeOf(knobs.scale, "m")} id={titleId} {...knobs.title}>
                {block.title}
              </DisplayTitle>
            ) : undefined
          }
          snap={block.scroll?.snap ?? false}
          steps={block.steps.map((step, i) => (
            <div key={step.title} data-slot="process-step" className="flex flex-col gap-3">
              <p data-slot="process-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
                {num(i)}
              </p>
              <h3 data-slot="process-title" className="type-heading-2 text-fg-primary">
                {step.title}
              </h3>
              {step.body ? (
                <p data-slot="process-body" className="max-w-prose type-body text-prose text-fg-secondary">
                  {step.body}
                </p>
              ) : null}
            </div>
          ))}
        >
          {(_p, active) => (
            <div data-slot="process-stage" aria-hidden="true" className="flex size-full items-center justify-center bg-surface-subtle sm:justify-end sm:pe-12 lg:pe-24">
              <p data-slot="process-stage-number" className="type-display-l numeric text-fg-primary">
                {num(active)}
              </p>
            </div>
          )}
        </Stage>
      </Section>
    )
  }
  const title = block.title ? (
    <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
      {block.title}
    </KnobTitle>
  ) : null
  if (knobs.variant === "rows") {
    return (
      <Section id={id} data-block="process" {...labelled} {...knobs.section}>
        {title}
        <KnobBody knobs={knobs}>
          <ol data-slot="process" data-variant="rows" role="list" className="col-span-full flex flex-col">
            {block.steps.map((step, i) => (
              <li key={step.title} data-slot="process-step" className="grid grid-cols-4 items-baseline gap-6 border-t border-line-primary py-8 lg:grid-cols-12">
                <p data-slot="process-number" aria-hidden="true" className="col-span-1 type-display-m numeric text-fg-secondary lg:col-span-2">
                  {num(i)}
                </p>
                <h3 data-slot="process-title" className="col-span-3 type-heading-1 text-fg-primary lg:col-span-4">
                  {step.title}
                </h3>
                {step.body ? (
                  <p data-slot="process-body" className="col-span-full max-w-prose type-body-lg text-prose text-fg-secondary lg:col-span-6">
                    {step.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </KnobBody>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="process" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
        <ol data-slot="process" role="list" className="col-span-full grid grid-cols-1 gap-8 md:grid-cols-3">
          {block.steps.map((step, i) => (
            <li key={step.title} data-slot="process-step" className="flex flex-col gap-3 border-t border-line-primary pt-4">
              <p data-slot="process-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
                {num(i)}
              </p>
              <h3 data-slot="process-title" className="type-title text-fg-primary">
                {step.title}
              </h3>
              {step.body ? (
                <p data-slot="process-body" className="max-w-prose type-body text-prose text-fg-secondary">
                  {step.body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </KnobBody>
    </Section>
  )
}
