import { DisplayTitle, MediaFrame, Magnetic, Section } from "@aleeforoughi/feather-expression"
import { mediaProps } from "./media"
import { BUTTON_PRIMARY, BUTTON_QUIET, useRegion, type BlockProps } from "./shared"

/** The first view: the page's only h1, one focal point, and the starters when the model is on. */
export function HeroBlock({ block, priority = true, onAsk }: BlockProps<"hero">) {
  const { id, titleId } = useRegion({ ...block, title: block.title }, "Introduction")
  const starters = onAsk ? (block.starters ?? []) : []
  return (
    <Section id={id} data-block="hero" aria-labelledby={titleId} space="xl">
      <div data-slot="hero-copy" className="col-span-full flex flex-col gap-6 md:col-span-10">
        {block.eyebrow ? (
          <p data-slot="hero-eyebrow" className="type-caps text-fg-secondary">
            {block.eyebrow}
          </p>
        ) : null}
        <DisplayTitle as="h1" size="xl" id={titleId}>
          {block.title}
        </DisplayTitle>
        {block.lede ? (
          <p data-slot="hero-lede" className="max-w-prose type-body-lg text-prose text-fg-secondary">
            {block.lede}
          </p>
        ) : null}
      </div>
      {starters.length > 0 ? (
        <ul data-slot="hero-starters" role="list" className="col-span-full mt-12 flex flex-wrap gap-3">
          {starters.map((starter, i) => {
            const button = (
              <button type="button" data-slot="hero-starter" data-variant={i === 0 ? "primary" : "quiet"} className={i === 0 ? BUTTON_PRIMARY : BUTTON_QUIET} onClick={() => onAsk?.(starter)}>
                {starter}
              </button>
            )
            return (
              <li key={starter} data-slot="hero-starter-item">
                {i === 0 ? <Magnetic>{button}</Magnetic> : button}
              </li>
            )
          })}
        </ul>
      ) : null}
      {block.media ? (
        <div data-slot="hero-media" className="col-span-full mt-16">
          <MediaFrame aspect="21/9" priority={priority} {...mediaProps(block.media, block.title)} />
        </div>
      ) : null}
    </Section>
  )
}
