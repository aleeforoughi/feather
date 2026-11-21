import { DisplayTitle, MediaFrame, Section } from "@aleeforoughi/feather-expression"
import { mediaProps } from "./media"
import { useRegion, type BlockProps } from "./shared"

/**
 * The one block only this brand has. Without a brand renderer it reads as a statement; `data-variant` carries
 * `block.variant` so the brand restyles it through tokens and CSS, not through this file.
 */
export function SignatureBlock({ block }: BlockProps<"signature">) {
  const { id, titleId, labelled } = useRegion(block, "Signature")
  return (
    <Section id={id} data-block="signature" {...labelled} space="l">
      <div data-slot="signature" data-variant={block.variant} className="col-span-full flex flex-col gap-8">
        {block.title ? (
          <DisplayTitle as="h2" size="l" id={titleId}>
            {block.title}
          </DisplayTitle>
        ) : null}
        {block.body ? (
          <p data-slot="signature-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {block.body}
          </p>
        ) : null}
        {block.media ? (
          <div data-slot="signature-media">
            <MediaFrame aspect="16/9" {...mediaProps(block.media, block.title)} />
          </div>
        ) : null}
      </div>
    </Section>
  )
}
