import * as React from "react"
import { MediaFrame, Section } from "@aleeforoughi/feather-expression"
import { EDGE_START, KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { sizesOf } from "./sizes"
import { join, useRegion, type BlockProps } from "./shared"

/** Where the divider starts, in percent from the start edge, when the page does not say. */
export const COMPARISON_START = 50

/** A label on its image, on the media scrim so it reads over any picture. */
function Chip({ children, end = false }: { children: string; end?: boolean }) {
  return (
    <span data-slot="comparison-label" className={join("pointer-events-none absolute top-4 z-layer-raised rounded-control bg-media-scrim px-3 py-1 type-label text-ink-on-media", end ? "right-4" : "left-4")}>
      {children}
    </span>
  )
}

/**
 * Before and after. With script, the two pictures lie one over the other and a native range (named, keyboard-driven,
 * its value spoken as both shares) moves the divider: a drag anywhere on the picture, or the arrow keys (Home and End
 * too). With no script it is the two pictures side by side, each with its label. Both pictures are always in the
 * document with their alt text; the range only moves a clip, so nothing moves on its own and it holds under reduced
 * motion. `start` (0 to 100) sets where the divider begins; crop edge or bleed takes the frame off the grid.
 */
export function ComparisonBlock({ block }: BlockProps<"comparison">) {
  const { id, titleId, labelled } = useRegion(block, "Before and after")
  const knobs = useKnobs<"slider">("comparison", block, { space: "l" })
  const [value, setValue] = React.useState(block.start ?? COMPARISON_START)
  const before = block.beforeLabel ?? "Before"
  const after = block.afterLabel ?? "After"
  const cropped = knobs.crop !== "none"
  const frame = (
    <div
      data-slot="comparison"
      className="group/compare relative grid grid-cols-2 gap-4 scripting:block"
      style={{ ["--split" as string]: `${value}%` }}
    >
      <div data-slot="comparison-before" className="relative aspect-square min-w-0 scripting:aspect-video">
        <MediaFrame aspect="16/9" className="h-full" style={{ aspectRatio: "auto" }} {...(cropped ? { radius: "none" as const } : {})} {...mediaProps(block.before, before, sizesOf("comparison.slider", cropped))} />
        <Chip>{before}</Chip>
      </div>
      <div data-slot="comparison-after" className="relative aspect-square min-w-0 scripting:absolute scripting:inset-0 scripting:aspect-auto scripting:[clip-path:inset(0_0_0_var(--split))]">
        <MediaFrame aspect="16/9" className="h-full" style={{ aspectRatio: "auto" }} {...(cropped ? { radius: "none" as const } : {})} {...mediaProps(block.after, after, sizesOf("comparison.slider", cropped))} />
        <Chip end>{after}</Chip>
      </div>
      {/* The divider and its grip: decoration that follows the range. */}
      <div data-slot="comparison-divider" aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-layer-raised hidden w-px -translate-x-1/2 bg-ink-on-media scripting:block" style={{ left: "var(--split)" }}>
        <span data-slot="comparison-grip" className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-on-media bg-media-scrim group-has-[:focus-visible]/compare:outline-2 group-has-[:focus-visible]/compare:outline-offset-2 group-has-[:focus-visible]/compare:outline-ring group-has-[:focus-visible]/compare:outline-solid" />
      </div>
      <input
        type="range"
        data-slot="comparison-range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label={`${before} and ${after}: move the divider`}
        aria-valuetext={`${before} ${value}%, ${after} ${100 - value}%`}
        onChange={(e) => setValue(Number(e.currentTarget.value))}
        className="absolute inset-0 z-layer-raised hidden size-full cursor-ew-resize touch-pan-y appearance-none opacity-0 scripting:block"
      />
    </div>
  )
  return (
    <Section id={id} data-block="comparison" {...labelled} {...knobs.section} {...(cropped ? { grid: false } : {})}>
      {cropped ? (
        <>
          {block.title || block.body ? (
            <div data-slot="comparison-head" className="page-grid">
              {block.title ? (
                <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
                  {block.title}
                </KnobTitle>
              ) : null}
              {block.body ? (
                <p data-slot="comparison-body" className="col-span-full mb-12 max-w-prose type-body-lg text-prose text-fg-secondary">
                  {block.body}
                </p>
              ) : null}
            </div>
          ) : null}
          <div data-slot="comparison-media" data-crop={knobs.crop} style={knobs.crop === "edge" ? EDGE_START : undefined}>
            {frame}
          </div>
        </>
      ) : (
        <>
          {block.title ? (
            <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
              {block.title}
            </KnobTitle>
          ) : null}
          <KnobBody knobs={knobs}>
            {block.body ? (
              <p data-slot="comparison-body" className="col-span-full mb-12 max-w-prose type-body-lg text-prose text-fg-secondary">
                {block.body}
              </p>
            ) : null}
            <div data-slot="comparison-frame" className={knobs.align === "center" ? "col-span-full lg:col-span-10 lg:col-start-2" : "col-span-full"}>
              {frame}
            </div>
          </KnobBody>
        </>
      )}
    </Section>
  )
}
