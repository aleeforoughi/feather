import type { Meta, StoryObj } from "@storybook/react-vite"
import type { WorldRenderer } from "../core/world"
import { World } from "./world"

// A tiny canvas-2D renderer: one gradient, drawn once, then it rests until invalidated.
const gradient: WorldRenderer = {
  frame({ canvas, width, height, pixelRatio }) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return false
    ctx.scale(pixelRatio, pixelRatio)
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, "Canvas")
    g.addColorStop(1, "GrayText")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    return false
  },
}

const still = <div data-slot="story-still" className="size-full bg-surface-subtle" />

const meta = {
  title: "Website/World",
  component: World,
  tags: ["autodocs"],
  parameters: {
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
    <div data-slot="story-frame" style={{ height: 240 }}>
      <World {...args} quality="medium" />
    </div>
  ),
}
export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced" data-slot="story-frame" style={{ height: 240 }}>
      <World {...args} />
    </div>
  ),
}
