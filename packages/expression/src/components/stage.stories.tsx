import type { Meta, StoryObj } from "@storybook/react-vite"
import { Stage } from "./stage"

const meta = {
  title: "Website/Stage",
  component: Stage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A sticky stage whose children scrub with scroll. Only the frame is pinned; the title and caption are ordinary HTML outside the scrubbed layer. With `steps`, text panels scroll past the pinned visual (one viewport each, never a pin longer than 4) and the step crossing the middle of the viewport is passed to the visual and set as `data-step`; `snap` settles on them by proximity. Under reduced motion it is a normal section with progress 1, and the steps stack in reading order, each with its visual.",
      },
    },
  },
} satisfies Meta<typeof Stage>

export default meta
type Story = StoryObj<typeof meta>

const Scene = ({ progress }: { progress: number }) => (
  <div data-slot="story-scene" className="flex size-full items-center justify-center bg-surface-subtle">
    <div data-slot="story-card" className="bg-surface-raised p-8 text-fg-primary rounded-card" style={{ transform: `translateY(${(1 - progress) * 32}px)`, opacity: 0.4 + progress * 0.6 }}>
      <p className="type-body numeric">Progress {Math.round(progress * 100)}%</p>
    </div>
  </div>
)

const Lead = ({ title, children }: { title: string; children: string }) => (
  <div data-slot="story-lead" className="page-grid min-h-dvh content-center gap-4 bg-surface-base py-24">
    <h1 className="col-span-full type-display-m text-fg-primary">{title}</h1>
    <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">{children}</p>
  </div>
)
const Tail = () => (
  <div data-slot="story-tail" className="page-grid min-h-dvh content-center bg-surface-base py-24">
    <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">Every cup we sell can be traced back to the farm, the lot and the day it was roasted.</p>
  </div>
)

export const Default: Story = {
  args: { length: 2, title: "One scroll, one scene", caption: "The scene scrubs as you scroll; this text stays real HTML.", "aria-label": "Scrubbed scene" },
  render: (args) => (
    <>
      <div className="h-dvh" data-slot="story-lead" />
      <Stage {...args}>{(p) => <Scene progress={p} />}</Stage>
      <div className="h-dvh" data-slot="story-tail" />
    </>
  ),
}

export const ReducedMotion: Story = {
  args: Default.args,
  render: (args) => (
    <div data-motion="reduced">
      <Stage {...args}>{(p) => <Scene progress={p} />}</Stage>
    </div>
  ),
}

// The roast, in four steps: each step's mark is drawn from the theme (primary, accent and the surfaces), and a ring
// closes as the section scrolls.
const STEPS = [
  { title: "Picked ripe", body: "Cherries are hand-picked at 1,800 metres, only when they turn deep red, over three passes of the same trees." },
  { title: "Washed and dried", body: "The fruit is stripped the same day and the beans dry on raised beds for 18 days, turned every hour by hand." },
  { title: "Roasted light", body: "We roast in 12 kg batches to just past first crack, so the fruit of the farm still reads in the cup." },
  { title: "Brewed slow", body: "Rested for a week, ground to order, and poured over at 94 °C: what you taste is the hillside, not the roaster." },
]

const Marks = [
  // A cherry on its stem.
  <g key="cherry">
    <path d="M200 120 C 210 150, 220 170, 214 200" className="fill-none stroke-line-primary" strokeWidth="6" strokeLinecap="round" />
    <circle cx="200" cy="250" r="70" className="fill-accent" />
    <circle cx="176" cy="226" r="14" className="fill-surface-raised" opacity="0.5" />
  </g>,
  // A green bean, split down the middle.
  <g key="bean">
    <ellipse cx="200" cy="230" rx="62" ry="92" transform="rotate(-24 200 230)" className="fill-primary" />
    <path d="M178 150 C 230 200, 170 260, 222 310" className="fill-none stroke-surface-raised" strokeWidth="8" strokeLinecap="round" />
  </g>,
  // A flame.
  <g key="flame">
    <path d="M200 120 C 260 190, 270 240, 250 290 C 236 326, 164 326, 150 290 C 132 244, 160 210, 182 180 C 186 214, 200 226, 212 230 C 222 196, 214 160, 200 120 Z" className="fill-accent" />
  </g>,
  // A cup with steam.
  <g key="cup">
    <path d="M130 200 H 270 V 270 C 270 310, 240 330, 200 330 C 160 330, 130 310, 130 270 Z" className="fill-primary" />
    <path d="M270 220 C 310 220, 310 280, 266 280" className="fill-none stroke-primary" strokeWidth="12" />
    <path d="M176 180 C 160 160, 192 146, 176 120 M 224 180 C 208 160, 240 146, 224 120" className="fill-none stroke-line-primary" strokeWidth="6" strokeLinecap="round" />
  </g>,
]

const RoastVisual = ({ progress, step }: { progress: number; step: number }) => (
  <div data-slot="story-roast" className="flex size-full items-center justify-center bg-surface-subtle">
    <svg viewBox="0 0 400 400" className="size-full max-h-dvh" role="img" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].title}`}>
      <circle cx="200" cy="225" r="150" className="fill-none stroke-line-tertiary" strokeWidth="4" />
      <circle cx="200" cy="225" r="150" className="fill-none stroke-accent" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - progress} transform="rotate(-90 200 225)" />
      {Marks.map((mark, i) => (
        <g key={i} className="motion-media" style={{ opacity: i === step ? 1 : 0, transform: i === step ? "none" : "translateY(12px)" }}>
          {mark}
        </g>
      ))}
    </svg>
  </div>
)

const steps = STEPS.map((s, i) => (
  <div key={s.title} data-slot="story-step" className="flex flex-col gap-2">
    <p className="type-caps text-fg-tertiary numeric">0{i + 1}</p>
    <h3 className="type-heading-3 text-fg-primary">{s.title}</h3>
    <p className="type-body text-fg-secondary">{s.body}</p>
  </div>
))

const roast = { title: <h2>From cherry to cup</h2>, caption: "Four steps between the hillside and your morning, in one pinned scene.", "aria-label": "How our coffee is made", steps }

export const Steps: Story = {
  args: roast,
  render: (args) => (
    <>
      <Lead title="Single origin, start to finish">We buy from one farm in Huila and do everything else ourselves. Scroll to follow a cherry to the cup.</Lead>
      <Stage {...args}>{(p, step) => <RoastVisual progress={p} step={step} />}</Stage>
      <Tail />
    </>
  ),
}

export const StepsWithSnap: Story = {
  args: { ...roast, snap: true },
  render: Steps.render,
}

export const StepsReducedMotion: Story = {
  args: roast,
  render: (args) => (
    <div data-motion="reduced">
      <Stage {...args}>{(p, step) => <RoastVisual progress={p} step={step} />}</Stage>
    </div>
  ),
}
