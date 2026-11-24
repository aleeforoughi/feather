import { Section } from "@aleeforoughi/feather-expression"
import { BlockTitle, useRegion, type BlockProps } from "./shared"

/** How the work is done: numbered steps in an ordered list (the visible number is decoration; the list counts). */
export function ProcessBlock({ block }: BlockProps<"process">) {
  const { id, titleId, labelled } = useRegion(block, "Process")
  return (
    <Section id={id} data-block="process" {...labelled} space="l">
      {block.title ? <BlockTitle id={titleId}>{block.title}</BlockTitle> : null}
      <ol data-slot="process" role="list" className="col-span-full grid grid-cols-1 gap-8 md:grid-cols-3">
        {block.steps.map((step, i) => (
          <li key={step.title} data-slot="process-step" className="flex flex-col gap-3 border-t border-line-primary pt-4">
            <p data-slot="process-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
              {String(i + 1).padStart(2, "0")}
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
