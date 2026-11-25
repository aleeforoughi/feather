import * as React from "react"
import {
  DisplayTitle,
  Marquee,
  Section,
  scrub,
  splitWords,
  useReducedMotion,
} from "@aleeforoughi/feather-expression"
import type { StatementVariant } from "../core/types"
import { scrollAllowed, sizeOf, useKnobs } from "./knobs"
import { BUTTON_QUIET, useRegion, type BlockProps } from "./shared"

function Body({
  text,
  className = "max-w-prose",
}: {
  text?: string
  className?: string
}) {
  return text ? (
    <p
      data-slot="statement-body"
      className={`${className} type-body-lg text-prose text-fg-secondary`}
    >
      {text}
    </p>
  ) : null
}

/** fill: the words take the full ink one by one as the statement crosses the viewport. They start at the secondary ink
 * (which already reads at 4.5:1), so the line is legible at every point; without script, under reduced motion and
 * below loudness 2 it is simply in full ink. */
function FillTitle({
  id,
  text,
  size,
}: {
  id: string
  text: string
  size: "xl" | "l" | "m" | "s"
}) {
  const root = React.useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotion(root)
  React.useEffect(() => {
    const el = root.current
    if (!el || reduced || !scrollAllowed(el)) return
    const words = [
      ...el.querySelectorAll<HTMLElement>('[data-slot="statement-word"]'),
    ]
    const n = words.length
    const stop = scrub(
      el,
      (p) => {
        // The fill runs while the line crosses from 90% to 40% of the viewport.
        const t = Math.min(1, Math.max(0, (p - 0.1) / 0.5)) * n
        words.forEach((w, i) => {
          const share = Math.round(Math.min(1, Math.max(0, t - i)) * 100)
          w.style.color = `color-mix(in oklab, var(--text-primary) ${share}%, var(--text-secondary))`
        })
      },
      { scrub: 0.3 }
    )
    return () => {
      stop()
      for (const w of words) w.style.color = ""
    }
  }, [reduced])
  return (
    <h2
      ref={root}
      id={id}
      data-slot="statement-fill"
      className={`type-display-${size} text-fg-primary`}
    >
      {splitWords(text).map((w, i) =>
        /^\s+$/.test(w) ? (
          w
        ) : (
          <span key={i} data-slot="statement-word">
            {w}
          </span>
        )
      )}
    </h2>
  )
}

/** swap: one word of the line changes in place. It repeats, so it has a pause control (WCAG 2.2.2); the title also
 * holds on hover, on focus, off screen and in a hidden tab, and is still under reduced motion. */
function SwapTitle({
  id,
  text,
  words,
  size,
  still,
}: {
  id: string
  text: string
  words: string[]
  size: "xl" | "l" | "m" | "s"
  still?: string
}) {
  const box = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion(box)
  const [paused, setPaused] = React.useState(false)
  // The control is there only where the words can move: not under reduced motion, nor below loudness 2.
  const [live, setLive] = React.useState(false)
  React.useEffect(
    () => setLive(!reduced && !still && scrollAllowed(box.current, "kinetic")),
    [reduced, still]
  )
  return (
    <div
      ref={box}
      data-slot="statement-swap"
      className="flex flex-col items-start gap-6"
    >
      <DisplayTitle
        as="h2"
        size={size}
        id={id}
        effect="swap"
        words={words}
        paused={paused}
        {...(still ? { "data-loudness": still } : {})}
      >
        {text}
      </DisplayTitle>
      {live ? (
        <button
          type="button"
          data-slot="statement-swap-toggle"
          data-state={paused ? "paused" : "playing"}
          aria-pressed={paused}
          className={BUTTON_QUIET}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Play the words" : "Pause the words"}
        </button>
      ) : null}
    </div>
  )
}

/**
 * One idea in display type, with an optional line of body. Variants (feather.page/1): plain (the default, as /0),
 * centred, offset (set off-axis on the grid, the body further in), marquee (the line as a slow band, with Marquee's
 * pause control; motion.direction left or right), fill (the words fill with ink as you scroll) and swap (one word
 * cycles through `words`; the title marks its place with {word}).
 */
export function StatementBlock({ block }: BlockProps<"statement">) {
  const { id, titleId } = useRegion(block, "Statement")
  const knobs = useKnobs<StatementVariant>("statement", block, { space: "l" })
  const v = knobs.variant
  const size = sizeOf(knobs.scale, "l")

  if (v === "centred") {
    return (
      <Section
        id={id}
        data-block="statement"
        aria-labelledby={titleId}
        {...knobs.section}
      >
        <div
          data-slot="statement"
          data-variant="centred"
          className="col-span-full flex flex-col items-center gap-8 text-center lg:col-span-10 lg:col-start-2"
        >
          <DisplayTitle
            as="h2"
            size={sizeOf(knobs.scale, "xl")}
            id={titleId}
            className="text-balance"
            {...knobs.title}
          >
            {block.title}
          </DisplayTitle>
          <Body text={block.body} className="mx-auto max-w-prose" />
        </div>
      </Section>
    )
  }
  if (v === "offset") {
    return (
      <Section
        id={id}
        data-block="statement"
        aria-labelledby={titleId}
        {...knobs.section}
      >
        <div
          data-slot="statement"
          data-variant="offset"
          className="col-span-full sm:col-span-6 sm:col-start-3 lg:col-span-8 lg:col-start-5"
        >
          <DisplayTitle as="h2" size={size} id={titleId} {...knobs.title}>
            {block.title}
          </DisplayTitle>
        </div>
        {block.body ? (
          <div
            data-slot="statement-aside"
            className="col-span-full mt-12 sm:col-span-4 sm:col-start-5 lg:col-span-4 lg:col-start-9"
          >
            <Body text={block.body} />
          </div>
        ) : null}
      </Section>
    )
  }
  if (v === "marquee") {
    const direction = block.motion?.direction === "right" ? "right" : "left"
    return (
      <Section
        id={id}
        data-block="statement"
        aria-labelledby={titleId}
        grid={false}
        {...knobs.section}
      >
        <h2 id={titleId} data-slot="statement-title" className="sr-only">
          {block.title}
        </h2>
        <div
          data-slot="statement"
          data-variant="marquee"
          className="page-inset"
        >
          <Marquee
            speed={40}
            direction={direction}
            pauseLabel="Pause the line"
            playLabel="Play the line"
          >
            <span
              data-slot="statement-band"
              aria-hidden="true"
              className={`type-display-${sizeOf(knobs.scale, "xl")} text-fg-primary`}
            >
              {block.title}
            </span>
            <span
              data-slot="statement-band-mark"
              aria-hidden="true"
              className={`type-display-${sizeOf(knobs.scale, "xl")} text-fg-secondary motion-reduce:hidden`}
            >
              /
            </span>
          </Marquee>
        </div>
        {block.body ? (
          <div data-slot="statement-after" className="page-grid mt-12">
            <div
              className="col-span-full lg:col-span-6"
              data-slot="statement-after-body"
            >
              <Body text={block.body} />
            </div>
          </div>
        ) : null}
      </Section>
    )
  }
  if (v === "fill" || (v === "swap" && block.words?.length)) {
    return (
      <Section
        id={id}
        data-block="statement"
        aria-labelledby={titleId}
        {...knobs.section}
      >
        <div
          data-slot="statement"
          data-variant={v}
          className="col-span-full flex flex-col gap-8 lg:col-span-10"
        >
          {v === "fill" ? (
            <FillTitle id={titleId} text={block.title} size={size} />
          ) : (
            <SwapTitle
              id={titleId}
              text={block.title}
              words={block.words ?? []}
              size={size}
              still={knobs.title["data-loudness"]}
            />
          )}
          <Body text={block.body} />
        </div>
      </Section>
    )
  }
  return (
    <Section
      id={id}
      data-block="statement"
      aria-labelledby={titleId}
      {...knobs.section}
    >
      <div
        data-slot="statement"
        className="col-span-full flex flex-col gap-8 md:col-span-10"
      >
        <DisplayTitle as="h2" size={size} id={titleId} {...knobs.title}>
          {block.title}
        </DisplayTitle>
        <Body text={block.body} />
      </div>
    </Section>
  )
}
