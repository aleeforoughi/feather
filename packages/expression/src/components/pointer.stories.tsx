import type { Meta, StoryObj } from "@storybook/react-vite"
import { Cursor } from "./magnetic"
import { PointerField } from "./pointer-field"
import { PointerTilt } from "./pointer-tilt"
import { PointerTrail } from "./pointer-trail"
import { RollText, UnderlineLink } from "./pointer-text"

const meta = {
  title: "Website/Pointer",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The pointer layer: Cursor states (data-cursor), PointerTilt, PointerField, PointerTrail, UnderlineLink and RollText. Everything needs a fine, hovering pointer and is off under reduced motion; Cursor, PointerTilt and PointerField need loudness 2, PointerTrail loudness 3. Touch screens get the plain page. These stories set data-loudness on their stage.",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const svg = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='1000' fill='url(#g)'/></svg>`)}`
const PICTURES = [svg("#e4e4e7", "#a1a1aa"), svg("#d4d4d8", "#52525b"), svg("#f4f4f5", "#71717a"), svg("#a1a1aa", "#27272a")]

const PROJECTS = [
  { name: "Aria", kind: "Identity for a regional airline", cursor: "view" as const },
  { name: "Northline", kind: "Product site for a rail-freight tracker", cursor: "view" as const },
  { name: "Field Notes", kind: "Editorial platform, 2026", cursor: "drag" as const },
  { name: "Reel 2026", kind: "Studio showreel, 90 seconds", cursor: "play" as const },
]

const Stage = ({ loudness = 3, children }: { loudness?: 2 | 3; children: React.ReactNode }) => (
  <div data-slot="story-stage" data-loudness={loudness} className="min-h-screen bg-surface-base p-12 text-fg-primary">
    {children}
  </div>
)

export const WorkGridCursor: Story = {
  render: () => (
    <Stage loudness={2}>
      <Cursor />
      <h2 className="type-display-s mb-8">Selected work</h2>
      <ul data-slot="story-grid" className="grid gap-6 sm:grid-cols-2">
        {PROJECTS.map((p, i) => (
          <li key={p.name}>
            <a href="#work" data-cursor={p.cursor} aria-label={`${p.name}: ${p.kind}`} className="block focus-ring rounded-card">
              <img src={PICTURES[i % PICTURES.length]} alt="" className="aspect-4/3 w-full rounded-card object-cover" />
              <span className="mt-3 block type-label">{p.name}</span>
              <span className="block type-body text-fg-secondary">{p.kind}</span>
            </a>
          </li>
        ))}
      </ul>
      <label className="mt-8 block max-w-sm">
        <span className="type-label">Tell us about your project</span>
        <input data-cursor="view" className="mt-2 h-control w-full rounded-control border border-line-primary bg-surface-base px-4 type-body" placeholder="Name@company.com" />
      </label>
    </Stage>
  ),
}

export const TiltedCard: Story = {
  render: () => (
    <Stage loudness={2}>
      <PointerTilt max={8} className="max-w-sm rounded-card bg-surface-subtle p-6">
        <img src={PICTURES[1]} alt="" className="aspect-4/3 w-full rounded-card object-cover" />
        <h3 className="mt-4 type-heading-m">Northline Annual Report</h3>
        <p className="type-body text-fg-secondary">Forty pages on how a small team moved two million tonnes of freight.</p>
        <a href="#report" className="mt-4 inline-block focus-ring type-label">
          Read the report
        </a>
      </PointerTilt>
    </Stage>
  ),
}

const TAGS = ["Identity", "Typography", "Motion", "Packaging", "Editorial", "Web", "Wayfinding", "Illustration", "Naming", "Film", "Systems", "Strategy"]

export const TagField: Story = {
  render: () => (
    <Stage loudness={2}>
      <PointerField radius={300} strength={0.6} className="mx-auto flex max-w-2xl flex-wrap justify-center gap-4 py-24">
        {TAGS.map((t) => (
          <span key={t} data-pointer-item className="rounded-full border border-line-primary px-5 py-2 type-label">
            {t}
          </span>
        ))}
      </PointerField>
    </Stage>
  ),
}

export const HeroTrail: Story = {
  render: () => (
    <Stage>
      <PointerTrail images={PICTURES} spacing={96} lifetime={900} className="grid min-h-96 place-items-center rounded-card bg-surface-subtle">
        <div className="relative max-w-xl p-8 text-center">
          <h1 className="type-display-m">We make brands people walk toward.</h1>
          <p className="mt-4 type-body text-fg-secondary">Move across the page. On a phone this section is simply a headline.</p>
        </div>
      </PointerTrail>
    </Stage>
  ),
}

export const LinksAndButtons: Story = {
  render: () => (
    <Stage loudness={2}>
      <nav aria-label="Studio" className="flex flex-wrap gap-8 type-body">
        <UnderlineLink href="#work">Work</UnderlineLink>
        <UnderlineLink href="#studio">Studio</UnderlineLink>
        <UnderlineLink href="#journal">Journal</UnderlineLink>
        <UnderlineLink href="#contact">Contact</UnderlineLink>
      </nav>
      <div className="mt-12 flex flex-wrap gap-4">
        <button type="button" className="group h-control rounded-control bg-surface-inverse px-6 type-label text-fg-inverse focus-ring">
          <RollText>Start a project</RollText>
        </button>
        <a href="#reel" className="group inline-flex h-control items-center rounded-control border border-line-primary px-6 type-label focus-ring">
          <RollText>Watch the reel</RollText>
        </a>
      </div>
    </Stage>
  ),
}

export const ReducedMotion: Story = {
  render: () => (
    <div data-motion="reduced">
      <Stage>
        <Cursor />
        <nav aria-label="Studio" className="flex gap-8 type-body">
          <UnderlineLink href="#work">Work</UnderlineLink>
          <UnderlineLink href="#studio">Studio</UnderlineLink>
        </nav>
        <PointerTilt className="mt-8 max-w-sm rounded-card bg-surface-subtle p-6">
          <p className="type-body">Nothing tilts, follows or rolls here. Colour and underline only.</p>
        </PointerTilt>
        <button type="button" className="group mt-8 h-control rounded-control bg-surface-inverse px-6 type-label text-fg-inverse focus-ring">
          <RollText>Start a project</RollText>
        </button>
      </Stage>
    </div>
  ),
}
