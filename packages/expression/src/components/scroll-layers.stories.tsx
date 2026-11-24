import type { Meta, StoryObj } from "@storybook/react-vite"
import { ScrollLayers } from "./scroll-layers"

const meta = {
  title: "Website/ScrollLayers",
  component: ScrollLayers,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Scroll choreography in one component. `parallax`: layers at depths 0.8 to 1.2 drift up to ±15% on a CSS view timeline (the one clock where the browser has none); decorative layers only, never body text. `stack`: cards stick a spacing step apart and the earlier one settles to 0.95 and dims. `horizontal`: a pinned row driven by vertical scroll on a fine pointer, a native snap rail with buttons on touch. `scale`: framed media grows to full bleed as the section pins, its caption on its own surface. Under reduced motion every variant rests at its complete state, in reading order. The page always scrolls natively.",
      },
    },
  },
} satisfies Meta<typeof ScrollLayers>

export default meta
type Story = StoryObj<typeof meta>

const Lead = ({ title, children }: { title: string; children: string }) => (
  <div data-slot="story-lead" className="page-grid min-h-dvh content-center gap-4 bg-surface-base py-24">
    <h1 className="col-span-full type-display-m text-fg-primary">{title}</h1>
    <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">{children}</p>
  </div>
)
const Tail = ({ children }: { children: string }) => (
  <div data-slot="story-tail" className="page-grid min-h-dvh content-center bg-surface-base py-24">
    <p className="col-span-full type-body-lg text-fg-secondary sm:col-span-6">{children}</p>
  </div>
)

// ── Parallax: a desert at dusk, three drawn layers and a headline that never moves ─────────────────────────────────

const Dunes = () => (
  <ScrollLayers variant="parallax" aria-label="The Erg Chebbi at dusk" className="min-h-dvh bg-surface-inverse">
    <ScrollLayers.Layer depth={0.8} aria-hidden="true" className="self-start">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className="h-dvh w-full">
        <circle cx="1040" cy="300" r="90" className="fill-accent" />
      </svg>
    </ScrollLayers.Layer>
    <ScrollLayers.Layer depth={0.9} aria-hidden="true" className="self-end">
      <svg viewBox="0 0 1440 400" preserveAspectRatio="none" className="h-64 w-full sm:h-96">
        <path d="M0 260 C 240 140, 420 200, 640 160 S 1100 60, 1440 180 V 400 H 0 Z" className="fill-primary" opacity="0.6" />
      </svg>
    </ScrollLayers.Layer>
    <ScrollLayers.Layer depth={1.2} aria-hidden="true" className="self-end">
      <svg viewBox="0 0 1440 300" preserveAspectRatio="none" className="h-40 w-full sm:h-64">
        <path d="M0 200 C 300 80, 520 120, 760 180 S 1200 260, 1440 120 V 300 H 0 Z" className="fill-primary" />
      </svg>
    </ScrollLayers.Layer>
    <div data-slot="story-copy" className="page-grid content-center py-24">
      <h2 className="col-span-full type-display-l text-fg-inverse">Three nights in the dunes</h2>
      <p className="col-span-full pt-4 type-body-lg text-fg-inverse sm:col-span-5">
        Camel at sunset, a camp lit by lanterns, and a sky with nothing in it but stars. The copy stays still; only the land moves.
      </p>
    </div>
  </ScrollLayers>
)

export const Parallax: Story = {
  args: { variant: "parallax", children: null },
  render: () => (
    <>
      <Lead title="Morocco, slowly">Twelve days from Marrakech to the Sahara, with one guide and never more than eight travellers.</Lead>
      <Dunes />
      <Tail>Departures run from October to April, when the desert is warm by day and cold enough for a fire by night.</Tail>
    </>
  ),
}

export const ParallaxReducedMotion: Story = {
  args: Parallax.args,
  render: () => (
    <div data-motion="reduced">
      <Dunes />
    </div>
  ),
}

// ── Stack: a studio's process, three cards that stack as you read ───────────────────────────────────────────────────

const PROCESS = [
  { n: "01", title: "Listen", body: "Two weeks with your team and your customers. We leave with the problem in their words, not ours.", tone: "bg-surface-raised" },
  { n: "02", title: "Make", body: "Prototypes from day three. Every idea is something you can hold, click or break, never a slide.", tone: "bg-surface-subtle" },
  { n: "03", title: "Prove", body: "We test with real people before launch and measure after it. What does not move the number is cut.", tone: "bg-surface-raised" },
]

const ProcessCards = () => (
  <ScrollLayers variant="stack" aria-label="How we work" className="bg-surface-base py-16">
    {PROCESS.map((step) => (
      <article key={step.n} data-slot="story-card" className={`flex min-h-80 flex-col justify-between gap-12 rounded-card border border-line-tertiary p-8 shadow-2 ${step.tone}`}>
        <p className="type-caps text-fg-tertiary numeric">{step.n}</p>
        <div data-slot="story-card-text" className="flex flex-col gap-3">
          <h3 className="type-display-s text-fg-primary">{step.title}</h3>
          <p className="max-w-prose type-body-lg text-fg-secondary">{step.body}</p>
        </div>
      </article>
    ))}
  </ScrollLayers>
)

export const Stack: Story = {
  args: { variant: "stack", children: null },
  render: () => (
    <>
      <Lead title="A small studio, on purpose">Six people, four projects a year, and the same three steps every time.</Lead>
      <ProcessCards />
      <Tail>Most projects run twelve to sixteen weeks from the first conversation to launch.</Tail>
    </>
  ),
}

export const StackReducedMotion: Story = {
  args: Stack.args,
  render: () => (
    <div data-motion="reduced">
      <ProcessCards />
    </div>
  ),
}

// ── Horizontal: selected work, a pinned row on desktop and a snap rail on touch ────────────────────────────────────

const WORK = [
  { client: "Halden Ferries", what: "Timetables people can read at a glance, on the dock and on the phone.", year: "2026", art: "from-primary to-accent" },
  { client: "Oro Bakery", what: "A shop that sells out by noon, so the site tells you what is left.", year: "2026", art: "from-accent to-surface-subtle" },
  { client: "Northfield Library", what: "One search for books, rooms and events, in eleven languages.", year: "2025", art: "from-surface-inverse to-primary" },
  { client: "Kiln & Co", what: "Commissions booked in three steps, with the kiln's real calendar.", year: "2025", art: "from-primary to-surface-subtle" },
  { client: "Tidewater Clinic", what: "Appointments, results and a nurse line, without a password to forget.", year: "2024", art: "from-accent to-primary" },
]

const Work = ({ label = "Selected work" }: { label?: string }) => (
  <ScrollLayers variant="horizontal" aria-label={label} className="bg-surface-base py-16">
    {WORK.map((w) => (
      <article key={w.client} data-slot="story-work" className="flex w-72 flex-col gap-4 sm:w-96">
        <div data-slot="story-work-art" className={`aspect-4/5 w-full rounded-card bg-linear-to-br ${w.art}`} aria-hidden="true" />
        <div data-slot="story-work-text" className="flex flex-col gap-1">
          <h3 className="type-heading-3 text-fg-primary">
            <a href={`#${w.client.toLowerCase().replace(/\W+/g, "-")}`} className="rounded-control focus-ring">
              {w.client}
            </a>
          </h3>
          <p className="type-body text-fg-secondary">{w.what}</p>
          <p className="type-caption text-fg-tertiary numeric">{w.year}</p>
        </div>
      </article>
    ))}
  </ScrollLayers>
)

export const Horizontal: Story = {
  args: { variant: "horizontal", children: null },
  render: () => (
    <>
      <Lead title="Work that gets used">Five recent projects. With a mouse, scroll down to move along; on touch, swipe the row.</Lead>
      <Work />
      <Tail>Every project page lists what changed for the people who use it, with the numbers.</Tail>
    </>
  ),
}

export const HorizontalReducedMotion: Story = {
  args: Horizontal.args,
  render: () => (
    <div data-motion="reduced">
      <Work />
    </div>
  ),
}

// ── Scale: an image that grows to full bleed as the section pins ──────────────────────────────────────────────────

const Atelier = () => (
  <ScrollLayers
    variant="scale"
    length={2}
    aria-label="The atelier"
    className="bg-surface-base"
    caption={
      <div data-slot="story-caption" className="flex flex-col gap-2">
        <h2 className="type-heading-2 text-fg-primary">The atelier, after hours</h2>
        <p className="type-body text-fg-secondary">Every frame is cut, joined and finished here, in one room in Porto, by four people.</p>
      </div>
    }
  >
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A workshop bench under a single lamp, tools hung on the wall behind it">
      <rect width="1600" height="900" className="fill-surface-inverse" />
      <path d="M520 0 L 1080 0 L 1300 900 L 300 900 Z" className="fill-accent" opacity="0.18" />
      <circle cx="800" cy="120" r="46" className="fill-accent" />
      <rect x="260" y="610" width="1080" height="36" rx="6" className="fill-primary" />
      <rect x="320" y="646" width="28" height="254" className="fill-primary" />
      <rect x="1252" y="646" width="28" height="254" className="fill-primary" />
      {[420, 520, 620, 980, 1080, 1180].map((x, i) => (
        <rect key={x} x={x} y={240 + (i % 3) * 30} width="18" height={180 - (i % 3) * 30} rx="9" className="fill-surface-subtle" opacity="0.7" />
      ))}
    </svg>
  </ScrollLayers>
)

export const Scale: Story = {
  args: { variant: "scale", children: null },
  render: () => (
    <>
      <Lead title="Made by hand in Porto">Frames in oak, walnut and ash, built to order and finished with oil, never lacquer.</Lead>
      <Atelier />
      <Tail>Orders placed this week ship in six weeks, wrapped in the offcuts of your own frame.</Tail>
    </>
  ),
}

export const ScaleReducedMotion: Story = {
  args: Scale.args,
  render: () => (
    <div data-motion="reduced">
      <Atelier />
    </div>
  ),
}
