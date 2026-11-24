import type { Meta, StoryObj } from "@storybook/react-vite"
import { Stage } from "./stage"

const meta = {
  title: "Website/Stage",
  component: Stage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "A sticky stage whose children scrub with scroll. Only the frame is pinned; the title and caption are ordinary HTML outside the scrubbed layer. Under reduced motion it is a normal section with progress 1." } },
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
