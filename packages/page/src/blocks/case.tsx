import { DisplayTitle, MediaFrame, ScrollLayers, Section, Split } from "@aleeforoughi/feather-expression"
import type { CaseVariant } from "../core/types"
import { EDGE_START, alignClass, sizeOf, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { SceneLayer } from "./scene"
import { useRegion, type BlockProps } from "./shared"

/**
 * One piece of work told. Variants (feather.page/1): editorial (the default, as /0: the medium beside the words, the
 * facts as a definition list) and scale (the media grows from an inset frame to full bleed as the section pins, the
 * words on their own surface beside it; ScrollLayers scale, which needs loudness 2 and rests still otherwise). crop
 * edge or bleed takes the editorial media off the grid; scroll.pattern parallax drifts it. A `scene` (loudness 3) takes
 * the media's place in the editorial frame: a model to turn and inspect, or a field, over the media as its poster.
 */
export function CaseBlock({ block }: BlockProps<"case">) {
  const { id, titleId } = useRegion(block, "Case")
  const knobs = useKnobs<CaseVariant>("case", block, { space: "l" })
  const facts = block.facts && block.facts.length > 0 ? (
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
  ) : null
  const text = (
    <div data-slot="case-text" className="flex flex-col gap-6">
      <DisplayTitle as="h2" size={sizeOf(knobs.scale, "m")} id={titleId} {...knobs.title}>
        {block.title}
      </DisplayTitle>
      {block.body ? (
        <p data-slot="case-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
          {block.body}
        </p>
      ) : null}
      {facts}
    </div>
  )

  if (knobs.variant === "scale" && block.media) {
    return (
      <Section id={id} data-block="case" aria-labelledby={titleId} grid={false} {...knobs.section}>
        <ScrollLayers variant="scale" caption={text} {...(block.scroll?.length ? { length: block.scroll.length } : {})}>
          <MediaFrame aspect="16/9" radius="none" {...mediaProps(block.media, block.title)} treatment={knobs.treatment} />
        </ScrollLayers>
      </Section>
    )
  }
  const pattern = block.scroll?.pattern
  const scene = block.scene
  const frame = (radius?: "none") => {
    if (scene) return <SceneLayer scene={scene} media={block.media} label={block.title} />
    const media = block.media ? <MediaFrame aspect="4/3" {...(radius ? { radius } : {})} {...mediaProps(block.media, block.title)} treatment={knobs.treatment} /> : null
    return pattern === "parallax" && media ? (
      <ScrollLayers variant="parallax">
        <ScrollLayers.Layer depth={0.9}>{media}</ScrollLayers.Layer>
      </ScrollLayers>
    ) : (
      media
    )
  }
  if ((block.media || scene) && knobs.crop !== "none") {
    // The media runs off the page's start edge (edge) or both (bleed); the words stay on the grid.
    return (
      <Section id={id} data-block="case" aria-labelledby={titleId} grid={false} {...knobs.section}>
        <div data-slot="case-crop" data-crop={knobs.crop} className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12" style={knobs.crop === "edge" ? { paddingInlineEnd: EDGE_START.paddingInlineStart } : undefined}>
          <div data-slot="case-media" className="lg:col-span-7">
            {frame("none")}
          </div>
          <div data-slot="case-side" className="px-6 lg:col-span-5 lg:px-0 lg:pe-12">
            {text}
          </div>
        </div>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="case" aria-labelledby={titleId} {...knobs.section}>
      {block.media || scene ? (
        <Split ratio="7:5">
          {frame()}
          {text}
        </Split>
      ) : (
        <div data-slot="case-solo" className={alignClass(knobs.align, "col-span-full md:col-span-8")}>
          {text}
        </div>
      )}
    </Section>
  )
}
