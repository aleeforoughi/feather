import { DisplayTitle, Section } from "@aleeforoughi/feather-expression"
import { useRegion, type BlockProps } from "./shared"

/** One idea in display type, with an optional line of body. */
export function StatementBlock({ block }: BlockProps<"statement">) {
  const { id, titleId } = useRegion(block, "Statement")
  return (
    <Section id={id} data-block="statement" aria-labelledby={titleId} space="l">
      <div data-slot="statement" className="col-span-full flex flex-col gap-8 md:col-span-10">
        <DisplayTitle as="h2" size="l" id={titleId}>
          {block.title}
        </DisplayTitle>
        {block.body ? (
          <p data-slot="statement-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {block.body}
          </p>
        ) : null}
      </div>
    </Section>
  )
}
