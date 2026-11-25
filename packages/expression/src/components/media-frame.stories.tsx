import type { Meta, StoryObj } from "@storybook/react-vite"
import { MediaFrame } from "./media-frame"

const svg = (a: string, b: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>`)}`
const IMAGE = svg("#d4d4d8", "#71717a")

const meta = {
  title: "Website/MediaFrame",
  component: MediaFrame,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "One framing rule for images and video: fixed aspect, 1px edge, clipped radius, a hover scale from 1. `priority` marks the LCP image (eager, high priority). A looping video longer than 5s has a pause button." } },
  },
  args: { src: IMAGE, alt: "A soft grey gradient standing in for a photograph", aspect: "16/9" },
} satisfies Meta<typeof MediaFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Priority: Story = { args: { priority: true, aspect: "21/9" } }
export const Portrait: Story = { args: { aspect: "4/5", radius: "dialog" }, decorators: [(Story) => <div className="w-80"><Story /></div>] }
export const Video: Story = {
  args: { alt: "A looping gradient clip", video: { autoPlay: true, loop: true, poster: IMAGE, duration: 12 }, sources: [] },
}
export const ReducedMotion: Story = {
  args: Video.args,
  render: (args) => <div data-motion="reduced"><MediaFrame {...args} /></div>,
}

/** The placeholder: the frame is painted from the theme (the subtle surface) until its image decodes. This image never
 * arrives, so the placeholder is what stays. */
export const Placeholder: Story = { args: { src: "/never-arrives.jpg", alt: "A photograph still on its way" } }
/** The film placeholder: the media scrim over the inverse surface, the ground copy over a film reads on. */
export const PlaceholderScrim: Story = { args: { src: "/never-arrives.jpg", alt: "A film still on its way", placeholder: "scrim" } }

const TREATMENTS = ["clip-reveal", "inner-parallax", "blur-to-sharp", "duotone", "grain"] as const
/** Every image treatment, side by side (the moving ones rest under reduced motion). */
export const Treatments: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {TREATMENTS.map((t) => (
        <figure key={t} className="flex flex-col gap-2">
          <MediaFrame {...args} aspect="4/3" treatment={t} />
          <figcaption className="type-caption text-fg-secondary">{t}</figcaption>
        </figure>
      ))}
    </div>
  ),
}
