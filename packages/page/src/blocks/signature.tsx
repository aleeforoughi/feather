import { DisplayTitle, MediaFrame, ScrollLayers, Section } from "@aleeforoughi/feather-expression"
import { EDGE_START, alignClass, sizeOf, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { join, useRegion, type BlockProps } from "./shared"

/**
 * The one block only this brand has. Without a brand renderer it reads as a statement; `data-variant` carries
 * `block.variant` so the brand restyles it through tokens and CSS, not through this file. The knobs apply as
 * everywhere: align, scale, crop (edge or bleed takes the media off the grid) and scroll.pattern parallax.
 */
export function SignatureBlock({ block }: BlockProps<"signature">) {
  const { id, titleId, labelled } = useRegion(block, "Signature")
  const knobs = useKnobs<string>("signature", block, { space: "l" })
  const centre = knobs.align === "center"
  const cropped = knobs.crop !== "none"
  const frame = block.media ? <MediaFrame aspect="16/9" {...(cropped ? { radius: "none" as const } : {})} {...mediaProps(block.media, block.title)} /> : null
  const media = frame ? (
    <div data-slot="signature-media" {...(knobs.any ? { "data-crop": knobs.crop } : {})} style={knobs.crop === "edge" ? EDGE_START : undefined}>
      {block.scroll?.pattern === "parallax" ? (
        <ScrollLayers variant="parallax">
          <ScrollLayers.Layer depth={0.9}>{frame}</ScrollLayers.Layer>
        </ScrollLayers>
      ) : (
        frame
      )}
    </div>
  ) : null
  const words = (
    <>
      {block.title ? (
        <DisplayTitle as="h2" size={sizeOf(knobs.scale, "l")} id={titleId} {...knobs.title}>
          {block.title}
        </DisplayTitle>
      ) : null}
      {block.body ? (
        <p data-slot="signature-body" className={join("max-w-prose type-body-lg text-prose text-fg-secondary", centre && "mx-auto")}>
          {block.body}
        </p>
      ) : null}
    </>
  )
  if (cropped && media) {
    return (
      <Section id={id} data-block="signature" {...labelled} grid={false} {...knobs.section}>
        <div data-slot="signature-grid" className="page-grid">
          <div data-slot="signature" data-variant={block.variant} className={join(alignClass(knobs.align, "col-span-full flex flex-col gap-8"), centre && "gap-8")}>
            {words}
          </div>
        </div>
        <div data-slot="signature-after" className="mt-12">
          {media}
        </div>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="signature" {...labelled} {...knobs.section}>
      <div data-slot="signature" data-variant={block.variant} className={join(alignClass(knobs.align, "col-span-full flex flex-col gap-8"), centre && "gap-8")}>
        {words}
        {media}
      </div>
    </Section>
  )
}
