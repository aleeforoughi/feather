import type { Meta, StoryObj } from "@storybook/react-vite"
import type { WorldRenderer } from "../core/world"
import { World } from "./world"

// A small canvas-2D renderer in the brand's own colours: a ground-to-primary gradient and three accent rings, drawn
// once, then it rests until invalidated. Colours come from the theme, so it re-skins with the brand.
const read = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback
const gradient: WorldRenderer = {
  frame({ canvas, width, height, pixelRatio }) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return false
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, read(canvas, "--background", "#f5f5f4"))
    g.addColorStop(1, read(canvas, "--primary", "#1c1917"))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = read(canvas, "--accent", "#ea580c")
    ctx.lineWidth = 2
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(width * 0.72, height * 0.5, (Math.min(width, height) / 8) * i, 0, Math.PI * 2)
      ctx.stroke()
    }
    return false
  },
}

// The poster every device the scene does not run on gets: never an empty frame.
const still = (
  <div data-slot="story-still" className="flex size-full items-end bg-surface-subtle p-6">
    <p className="type-heading-2 text-fg-primary">The poster: shown before the first frame, and wherever the scene does not run.</p>
  </div>
)

const meta = {
  title: "Website/World",
  component: World,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "World is the page's one canvas slot. The server and first render show the still; then the device picks a quality tier and the brand's renderer runs on the one clock, on demand. The canvas is decorative and never the LCP element. Under reduced motion it stays a still.",
      },
    },
  },
  args: { renderer: gradient, still },
} satisfies Meta<typeof World>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <div data-slot="story-frame" className="w-full" style={{ height: 240 }}>
      <World {...args} quality="medium" />
    </div>
  ),
}
/** No quality given: the capability gate decides. A device it turns away (touch, little memory, no WebGL, data
 * saving, reduced motion, or retired after struggling) sees the poster. */
export const Gated: Story = {
  render: (args) => (
    <div data-slot="story-frame" className="w-full" style={{ height: 240 }}>
      <World {...args} />
    </div>
  ),
}
/** The light tier: what everyone the gate turns away sees. */
export const Poster: Story = {
  render: (args) => (
    <div data-slot="story-frame" className="w-full" style={{ height: 240 }}>
      <World {...args} quality="static" />
    </div>
  ),
}
export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced" data-slot="story-frame" className="w-full" style={{ height: 240 }}>
      <World {...args} />
    </div>
  ),
}
