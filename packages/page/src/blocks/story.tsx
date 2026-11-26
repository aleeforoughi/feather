import { DisplayTitle, MediaFrame, Section, Stage } from "@aleeforoughi/feather-expression"
import type { StoryStep, StoryVariant } from "../core/types"
import { KnobTitle, sizeOf, useKnobs } from "./knobs"
import { mediaProps } from "./media"
import { sizesOf } from "./sizes"
import { useRegion, type BlockProps } from "./shared"

const num = (i: number) => String(i + 1).padStart(2, "0")

function StepText({ step, i }: { step: StoryStep; i: number }) {
  return (
    <div data-slot="story-step" className="flex flex-col gap-3">
      <p data-slot="story-number" aria-hidden="true" className="type-caps numeric text-fg-secondary">
        {num(i)}
      </p>
      <h3 data-slot="story-step-title" className="type-heading-2 text-fg-primary">
        {step.title}
      </h3>
      {step.body ? (
        <p data-slot="story-step-body" className="max-w-prose type-body text-prose text-fg-secondary">
          {step.body}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A story in two to six steps, each with its picture. pinned (the default): the picture stays pinned while the steps
 * scroll past, and changes to the step crossing the middle of the view, arriving on the media role (Stage with steps;
 * scroll.snap settles on them). It needs loudness 2: below that, under reduced motion and with no script, Stage stacks
 * the steps in reading order, each with its own picture. stacked: always that form. The picture's frame keeps its
 * size and shows the theme's placeholder until each image decodes, so nothing shifts as it changes.
 */
export function StoryBlock({ block }: BlockProps<"story">) {
  const { id, titleId, labelled } = useRegion(block, "Story")
  const knobs = useKnobs<StoryVariant>("story", block, { space: "l" })
  const steps = block.steps
  if (knobs.variant === "stacked") {
    return (
      <Section id={id} data-block="story" {...labelled} {...knobs.section}>
        {block.title ? (
          <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
            {block.title}
          </KnobTitle>
        ) : null}
        <ol data-slot="story-steps" role="list" className="col-span-full flex flex-col gap-16">
          {steps.map((step, i) => (
            <li key={step.title} data-slot="story-item" className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 lg:gap-12">
              <MediaFrame aspect="4/3" {...mediaProps(step.media, undefined, sizesOf("story.stacked"))} treatment={knobs.treatment} />
              <StepText step={step} i={i} />
            </li>
          ))}
        </ol>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="story" {...labelled} grid={false} {...knobs.section}>
      <Stage
        title={
          block.title ? (
            <DisplayTitle as="h2" size={sizeOf(knobs.scale, "m")} id={titleId} {...knobs.title}>
              {block.title}
            </DisplayTitle>
          ) : undefined
        }
        snap={block.scroll?.snap ?? false}
        steps={steps.map((step, i) => (
          <StepText key={step.title} step={step} i={i} />
        ))}
      >
        {(_p, active) => {
          const step = steps[Math.min(active, steps.length - 1)]
          // One picture at a time: keyed by its step, so each arrives fresh (from transparent, on the media role).
          return (
            <div data-slot="story-visual" className="relative size-full">
              <MediaFrame
                key={active}
                aspect="16/9"
                radius="none"
                className="absolute! inset-0 h-full motion-media starting:opacity-0"
                style={{ aspectRatio: "auto" }}
                {...mediaProps(step.media, undefined, sizesOf("story.pinned"))}
                treatment={knobs.treatment}
              />
            </div>
          )
        }}
      </Stage>
    </Section>
  )
}
