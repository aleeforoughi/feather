import type { Meta, StoryObj } from "@storybook/react-vite"
import { Presence } from "./presence"

const Mark = () => (
  <svg data-slot="story-mark" role="img" aria-label="" width="96" height="96" viewBox="0 0 96 96" className="text-fg-primary">
    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="1" />
    <circle cx="48" cy="48" r="16" fill="currentColor" />
  </svg>
)

const meta = {
  title: "Living/Presence",
  component: Presence,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: { description: { component: "The brand's slot (a film, a mark or an object). It leans in toward the reader while the agent thinks and breathes while it speaks. No dots, no spinner, no stock avatar. Decorative: the byline names the speaker. Reduced motion: no lean, no breath." } },
  },
  args: { kind: "mark", state: "idle", children: <Mark /> },
} satisfies Meta<typeof Presence>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Thinking: Story = { args: { state: "thinking" } }
export const Speaking: Story = { args: { state: "speaking" } }
export const ReducedMotion: Story = { args: { state: "thinking" }, decorators: [(Story) => <div data-motion="reduced">{Story()}</div>] }
