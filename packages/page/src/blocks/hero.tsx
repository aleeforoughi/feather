import * as React from "react"
import { DisplayTitle, MediaFrame, Magnetic, ScrollLayers, Section, prefersSaveData, useReducedMotion } from "@aleeforoughi/feather-expression"
import type { ActionLink, HeroVariant, Media } from "../core/types"
import { EDGE_START, PageContext, alignClass, sizeOf, useKnobs, type ResolvedKnobs } from "./knobs"
import { ON_MEDIA, mediaProps, srcsetOf } from "./media"
import { sizesOf } from "./sizes"
import { SceneLayer } from "./scene"
import { BUTTON_PRIMARY, BUTTON_QUIET, CHIP, filledAction, join, useRegion, type BlockProps } from "./shared"

/** The starters (when the model is on). On a /0 page they are buttons, the first filled and leaning toward the
 * pointer. On a /1 page they are chips, the composer's suggestions: one quiet row, so the section keeps one filled
 * action (its own link, or none). */
function Starters({ starters, onAsk, chips, className }: { starters: string[]; onAsk?: (s: string) => void; chips: boolean; className: string }) {
  if (starters.length === 0) return null
  return (
    <ul data-slot="hero-starters" role="list" className={className}>
      {starters.map((starter, i) => {
        const lead = i === 0 && !chips
        const button = (
          <button type="button" data-slot="hero-starter" data-variant={chips ? "chip" : lead ? "primary" : "quiet"} className={chips ? CHIP : lead ? BUTTON_PRIMARY : BUTTON_QUIET} onClick={() => onAsk?.(starter)}>
            {starter}
          </button>
        )
        return (
          <li key={starter} data-slot="hero-starter-item">
            {i === 0 && !chips ? <Magnetic>{button}</Magnetic> : button}
          </li>
        )
      })}
    </ul>
  )
}

/** The hero's real links (feather.page/1): the next act that works with the model off. One is filled (filledAction:
 * the first, or the one marked primary) when no starter leads; the rest are quiet. */
function Actions({ actions, lead, className }: { actions?: ActionLink[]; lead: boolean; className: string }) {
  if (!actions?.length) return null
  const filled = filledAction(actions, lead)
  return (
    <ul data-slot="hero-actions" role="list" className={className}>
      {actions.map((a, i) => (
        <li key={a.href} data-slot="hero-action-item">
          <a href={a.href} data-slot="hero-action" data-variant={i === filled ? "primary" : "quiet"} className={i === filled ? BUTTON_PRIMARY : BUTTON_QUIET}>
            {a.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

function Facts({ facts, className }: { facts: { label: string; value: string }[]; className: string }) {
  if (facts.length === 0) return null
  return (
    <dl data-slot="hero-facts" className={className}>
      {facts.map((f) => (
        <div key={f.label} data-slot="hero-fact" className="flex flex-col gap-1 border-t border-line-primary pt-3">
          <dt data-slot="hero-fact-label" className="type-caps text-fg-secondary">
            {f.label}
          </dt>
          <dd data-slot="hero-fact-value" className="type-title text-fg-primary">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Eyebrow({ text }: { text?: string }) {
  return text ? (
    <p data-slot="hero-eyebrow" className="type-caps text-fg-secondary">
      {text}
    </p>
  ) : null
}

function Lede({ text, className = "max-w-prose" }: { text?: string; className?: string }) {
  return text ? (
    <p data-slot="hero-lede" className={join(className, "type-body-lg text-prose text-fg-secondary")}>
      {text}
    </p>
  ) : null
}

/** Media in the hero's flow. `scroll.pattern` parallax drifts it (decoration only); scale grows it to full bleed as the
 * section pins. Both rest still under reduced motion and below loudness 2. */
function FlowMedia({ media, alt, priority, knobs, pattern, className }: { media: Media; alt: string; priority: boolean; knobs: ResolvedKnobs<HeroVariant>; pattern?: string; className: string }) {
  const cropped = knobs.crop !== "none"
  const sizes = sizesOf(knobs.variant === "stacked" ? "hero.stacked" : "hero.giant-type", cropped)
  const frame = <MediaFrame aspect="21/9" priority={priority} {...(cropped ? { radius: "none" as const } : {})} {...mediaProps(media, alt, sizes)} treatment={knobs.treatment} />
  const moved =
    pattern === "parallax" ? (
      <ScrollLayers variant="parallax">
        <ScrollLayers.Layer depth={0.9}>{frame}</ScrollLayers.Layer>
      </ScrollLayers>
    ) : pattern === "scale" ? (
      <ScrollLayers variant="scale" length={2}>
        <MediaFrame aspect="16/9" radius="none" priority={priority} {...mediaProps(media, alt, sizesOf("hero.stacked", true))} treatment={knobs.treatment} />
      </ScrollLayers>
    ) : (
      frame
    )
  return (
    <div data-slot="hero-media" data-crop={knobs.any ? knobs.crop : undefined} className={className} style={knobs.crop === "edge" ? EDGE_START : undefined}>
      {moved}
    </div>
  )
}

/** The page's sections as an editorial index: the index hero's focal point, every entry a real in-page link. */
function Index({ entries }: { entries: { id: string; title: string }[] }) {
  return (
    <nav data-slot="hero-index" aria-label="Contents" className="col-span-full mt-12 lg:col-span-6 lg:col-start-7 lg:mt-0">
      <ol data-slot="hero-index-list" role="list" className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id} data-slot="hero-index-item" className="border-t border-line-primary">
            <a href={`#${e.id}`} data-slot="hero-index-link" className="group flex min-h-12 items-baseline gap-6 py-4 focus-ring">
              <span data-slot="hero-index-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span data-slot="hero-index-title" className="type-heading-2 text-fg-primary underline-offset-4 group-hover:underline">
                {e.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

const noSubscription = () => () => {}

/**
 * The film hero's media: full bleed under a scrim, with a pause control above the scrim. The poster (or the image) is
 * the LCP: an eager, high-priority image the server writes, painted over the media scrim until it decodes, so the copy
 * reads from the first frame. The film itself arrives only after mount, where motion is allowed and the visitor has
 * not asked to save data: under reduced motion and on data saver the poster stays alone, with a Play control for
 * whoever wants the film anyway. With no script it is the poster, and the control is not shown.
 */
function Film({ media, alt, priority }: { media: Media; alt: string; priority: boolean }) {
  const p = mediaProps(media, alt)
  const box = React.useRef<HTMLDivElement>(null)
  const player = React.useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion(box)
  // Data saver is read after hydration (the server and the hydrating render assume it, as they assume reduced motion).
  const saving = React.useSyncExternalStore(noSubscription, prefersSaveData, () => true)
  const [choice, setChoice] = React.useState<"play" | "pause" | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const poster = p.video?.poster
  const auto = !!p.video && !reduced && !saving
  // The film comes when motion allows it or the visitor asks for it, and a pause keeps it; without a poster it is the
  // only picture, so it is always there.
  const film = !!p.video && (!poster || auto || choice !== null)
  React.useEffect(() => {
    const v = player.current
    if (!v) return
    if (choice === "play" || (choice === null && auto)) void v.play?.()?.catch?.(() => {})
    else v.pause?.()
  }, [choice, auto, film])
  const toggle = () => {
    if (playing) {
      setChoice("pause")
      player.current?.pause?.()
    } else {
      setChoice("play")
      void player.current?.play?.()?.catch?.(() => {})
    }
  }
  const still = p.video ? poster : p.src
  return (
    <div ref={box} data-slot="hero-film" data-state={ready ? "ready" : undefined} className="absolute inset-0 media-placeholder-scrim">
      {still ? (
        <img
          data-slot="hero-film-poster"
          className="block size-full object-cover"
          src={still}
          {...(typeof media === "object" && media.srcset ? { srcSet: srcsetOf(media.srcset), sizes: sizesOf("hero.film") } : {})}
          alt={p.decorative ? "" : (p.alt ?? "")}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setReady(true)}
          {...(priority ? { fetchPriority: "high" as const } : {})}
        />
      ) : null}
      {film && p.video ? (
        <video
          ref={player}
          data-slot="hero-film-media"
          className="absolute inset-0 block size-full object-cover"
          poster={poster}
          muted
          loop
          playsInline
          preload={saving || reduced ? "none" : priority ? "auto" : "metadata"}
          // The poster image carries the alt text; the film over it is the same picture, moving.
          aria-hidden={still ? true : p.decorative ? true : undefined}
          aria-label={still || p.decorative ? undefined : p.alt}
          src={p.sources?.length ? undefined : p.src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          {p.sources?.map((s) => (
            <source key={s.src + s.type} data-slot="hero-film-source" src={s.src} type={s.type} />
          ))}
        </video>
      ) : null}
      {/* The media scrim (feather-tokens/4) holds text-ink-on-media at 4.5:1 over any frame. */}
      <div data-slot="hero-film-scrim" aria-hidden="true" className="absolute inset-0 bg-media-scrim" />
      {p.video ? (
        <div data-slot="hero-film-control" className="absolute bottom-6 right-6 z-layer-raised noscript:hidden">
          <button type="button" data-slot="hero-film-toggle" data-variant={playing ? "pause" : "play"} onClick={toggle} className={BUTTON_QUIET}>
            {playing ? "Pause film" : "Play film"}
          </button>
        </div>
      ) : null}
    </div>
  )
}


/**
 * The first view: the page's only h1, one focal point, and the starters when the model is on. Variants (feather.page/1):
 * - stacked (the default, as /0): the display title, the lede, the starters, then the media;
 * - giant-type: the title across the full width at xl with a kinetic effect (mask unless motion.enter names one), the
 *   lede and the acts in a row under it;
 * - split: the copy beside the media (crop edge or bleed runs the media off the right edge);
 * - film: full-bleed media under a scrim, the copy on it, and a pause control (crop none keeps it inside the grid);
 * - product: one product centred, its facts around it, the act under it;
 * - index: the title beside an editorial index of the page's sections (giant-type when there are none);
 * - interactive: giant-type over its scene (`scene`, loudness 3): a shader, particles, a depth image or a camera rail
 *   fills the hero behind the words; a model stands in the flow under them. Its poster (the media, or a field in the
 *   theme's colours) is the LCP and what every device the scene does not run on keeps. Without a scene it is giant-type.
 */
export function HeroBlock({ block, priority = true, onAsk }: BlockProps<"hero">) {
  const { id, titleId } = useRegion({ ...block, title: block.title }, "Introduction")
  const knobs = useKnobs<HeroVariant>("hero", block, { space: "xl" })
  const page = React.useContext(PageContext)
  const starters = onAsk ? (block.starters ?? []) : []
  const pattern = block.scroll?.pattern
  const facts = block.facts ?? []
  const index = (page.index ?? []).filter((e) => e.id !== block.id)
  let variant = knobs.variant
  if ((variant === "interactive" && !block.scene) || (variant === "index" && index.length === 0)) variant = "giant-type"
  if ((variant === "split" || variant === "film" || variant === "product") && !block.media) variant = "giant-type"
  const title = (size: "xl" | "l", className?: string, effect = knobs.title.effect) => (
    <DisplayTitle as="h1" size={sizeOf(knobs.scale, size)} id={titleId} {...knobs.title} effect={effect} {...(className ? { className } : {})}>
      {block.title}
    </DisplayTitle>
  )
  // A /1 page: the starters are chips, a secondary row after the links, and the links keep their one filled action.
  const chips = page.one === true
  const lead = chips || starters.length === 0
  // The starters and the links as one row of acts.
  const acts = (className: string) =>
    starters.length > 0 || block.actions?.length ? (
      <div data-slot="hero-acts-row" className={className}>
        {chips ? <Actions actions={block.actions} lead={lead} className="flex flex-wrap gap-3" /> : null}
        <Starters starters={starters} onAsk={onAsk} chips={chips} className="flex flex-wrap gap-3" />
        {chips ? null : <Actions actions={block.actions} lead={lead} className="flex flex-wrap gap-3" />}
      </div>
    ) : null

  if (variant === "stacked") {
    const centre = knobs.align === "center"
    const copy = (
      <div data-slot="hero-copy" className={alignClass(knobs.align, "col-span-full flex flex-col gap-6 md:col-span-10")}>
        <Eyebrow text={block.eyebrow} />
        {title("xl")}
        <Lede text={block.lede} className={centre ? "mx-auto max-w-prose" : "max-w-prose"} />
      </div>
    )
    const rest = (
      <>
        {chips ? (
          <>
            <Actions actions={block.actions} lead={lead} className={join("col-span-full mt-12 flex flex-wrap gap-3", centre && "justify-center")} />
            <Starters starters={starters} onAsk={onAsk} chips className={join("col-span-full flex flex-wrap gap-2", block.actions?.length ? "mt-4" : "mt-12", centre && "justify-center")} />
          </>
        ) : (
          <>
            <Starters starters={starters} onAsk={onAsk} chips={false} className={join("col-span-full mt-12 flex flex-wrap gap-3", centre && "justify-center")} />
            <Actions actions={block.actions} lead={lead} className={join("col-span-full flex flex-wrap gap-3", starters.length === 0 ? "mt-12" : "mt-3", centre && "justify-center")} />
          </>
        )}
        {facts.length > 0 ? <Facts facts={facts} className="col-span-full mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4" /> : null}
      </>
    )
    if (knobs.crop !== "none" && block.media) {
      return (
        <Section id={id} data-block="hero" aria-labelledby={titleId} grid={false} {...knobs.section}>
          <div data-slot="hero-grid" className="page-grid">
            {copy}
            {rest}
          </div>
          <FlowMedia media={block.media} alt={block.title} priority={priority} knobs={knobs} pattern={pattern} className="mt-16 w-full" />
        </Section>
      )
    }
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section}>
        {copy}
        {rest}
        {block.media ? <FlowMedia media={block.media} alt={block.title} priority={priority} knobs={knobs} pattern={pattern} className="col-span-full mt-16" /> : null}
      </Section>
    )
  }

  if (variant === "split" && block.media) {
    const copy = (
      <div data-slot="hero-copy" className="flex flex-col gap-6">
        <Eyebrow text={block.eyebrow} />
        {title("l")}
        <Lede text={block.lede} />
        {acts("mt-6 flex flex-wrap gap-3")}
        {facts.length > 0 ? <Facts facts={facts} className="mt-6 grid grid-cols-2 gap-6" /> : null}
      </div>
    )
    if (knobs.crop !== "none") {
      return (
        <Section id={id} data-block="hero" aria-labelledby={titleId} grid={false} {...knobs.section}>
          <div data-slot="hero-split" className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2" style={EDGE_START}>
            <div data-slot="hero-split-copy" className="pe-6 lg:pe-12">
              {copy}
            </div>
            <div data-slot="hero-media" data-crop={knobs.crop}>
              <MediaFrame aspect="4/5" radius="none" priority={priority} {...mediaProps(block.media, block.title, sizesOf("hero.split", true))} treatment={knobs.treatment} />
            </div>
          </div>
        </Section>
      )
    }
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section}>
        <div data-slot="hero-split" className="col-span-full grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div data-slot="hero-split-copy" className="lg:col-span-6">
            {copy}
          </div>
          <div data-slot="hero-media" className="lg:col-span-6">
            <MediaFrame aspect="4/5" priority={priority} {...mediaProps(block.media, block.title, sizesOf("hero.split"))} treatment={knobs.treatment} />
          </div>
        </div>
      </Section>
    )
  }

  if (variant === "film" && block.media) {
    const frame = (
      <div data-slot="hero-film-frame" className={join("relative isolate flex min-h-svh flex-col justify-end overflow-hidden text-ink-on-media", block.crop === "none" && "rounded-card")} style={ON_MEDIA}>
        <Film media={block.media} alt={block.title} priority={priority} />
        <div data-slot="hero-film-body" className="page-grid relative z-layer-raised pb-24 pt-32">
          <div data-slot="hero-copy" className={alignClass(knobs.align, "col-span-full flex flex-col gap-6 lg:col-span-9")}>
            <Eyebrow text={block.eyebrow} />
            {title("xl")}
            <Lede text={block.lede} />
            {acts("mt-6 flex flex-wrap gap-3")}
          </div>
        </div>
      </div>
    )
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} grid={false} {...knobs.section} space={block.space ?? "s"} style={block.crop === "none" ? knobs.section.style : { ...knobs.section.style, paddingBlock: 0 }}>
        {block.crop === "none" ? (
          <div data-slot="hero-film-inset" className="page-inset">
            {frame}
          </div>
        ) : (
          frame
        )}
      </Section>
    )
  }

  if (variant === "product" && block.media) {
    const half = Math.ceil(facts.length / 2)
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section}>
        <div data-slot="hero-copy" className="col-span-full flex flex-col items-center gap-6 text-center">
          <Eyebrow text={block.eyebrow} />
          {title("l", "text-balance")}
          <Lede text={block.lede} className="mx-auto max-w-prose" />
        </div>
        <div data-slot="hero-product" className="col-span-full mt-12 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <Facts facts={facts.slice(0, half)} className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-3" />
          <div data-slot="hero-media" className="order-1 mx-auto w-full max-w-xl lg:order-2 lg:col-span-6">
            <MediaFrame aspect="1/1" priority={priority} {...mediaProps(block.media, block.title, sizesOf("hero.product"))} treatment={knobs.treatment} />
          </div>
          <Facts facts={facts.slice(half)} className="order-3 flex flex-col gap-6 lg:col-span-3 lg:text-end" />
        </div>
        <div data-slot="hero-acts" className="col-span-full mt-12 flex flex-col items-center gap-3">
          {acts("flex flex-wrap justify-center gap-3")}
        </div>
      </Section>
    )
  }

  if (variant === "index") {
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section}>
        <div data-slot="hero-copy" className="col-span-full flex flex-col gap-6 lg:col-span-5">
          <Eyebrow text={block.eyebrow} />
          {title("l")}
          <Lede text={block.lede} />
          {acts("mt-6 flex flex-wrap gap-3")}
        </div>
        <Index entries={index} />
      </Section>
    )
  }

  if (variant === "interactive" && block.scene) {
    const model = block.scene.kind === "model"
    // A scene behind the words fills the whole band. The section's own rise would make its content the scene's
    // containing block while it moves (a transform), resizing the scene under the words: the copy is simply there,
    // and the title keeps its own entrance.
    return (
      <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section} {...(model ? {} : { reveal: false, className: "isolate overflow-hidden" })}>
        {model ? null : <SceneLayer scene={block.scene} media={block.media} label={block.title} placement="behind" priority={priority} sizes={sizesOf("hero.interactive")} />}
        <div data-slot="hero-copy" className="col-span-full flex flex-col gap-8">
          <Eyebrow text={block.eyebrow} />
          {title("xl", "text-balance", block.motion?.enter ? knobs.title.effect : "mask")}
        </div>
        <div data-slot="hero-row" className="col-span-full mt-12 grid grid-cols-1 items-end gap-8 lg:grid-cols-2">
          <Lede text={block.lede} />
          <div data-slot="hero-acts" className="flex flex-col gap-3 lg:items-end">
            {acts("flex flex-wrap gap-3 lg:justify-end")}
          </div>
        </div>
        {model ? <SceneLayer scene={block.scene} media={block.media} label={block.title} aspect="16/9" priority={priority} sizes={sizesOf("hero.giant-type")} className="col-span-full mt-16" /> : null}
      </Section>
    )
  }

  // giant-type (and interactive without a scene).
  return (
    <Section id={id} data-block="hero" aria-labelledby={titleId} {...knobs.section}>
      <div data-slot="hero-copy" className="col-span-full flex flex-col gap-8">
        <Eyebrow text={block.eyebrow} />
        {title("xl", "text-balance", block.motion?.enter ? knobs.title.effect : "mask")}
      </div>
      <div data-slot="hero-row" className="col-span-full mt-12 grid grid-cols-1 items-end gap-8 lg:grid-cols-2">
        <Lede text={block.lede} />
        <div data-slot="hero-acts" className="flex flex-col gap-3 lg:items-end">
          {acts("flex flex-wrap gap-3 lg:justify-end")}
        </div>
      </div>
      {block.media ? <FlowMedia media={block.media} alt={block.title} priority={priority} knobs={knobs} pattern={pattern} className="col-span-full mt-16" /> : null}
    </Section>
  )
}
