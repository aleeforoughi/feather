import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Block } from "../core/blocks"
import type { PreparedScene } from "../core/prepared"
import { createRegistry } from "../core/registry"
import { PreparedSceneView } from "./prepared-scene"

const Statement = ({ block }: { block: Block }) => (
  <p data-slot="story-block" className="type-body text-fg-secondary">
    {String(block.title)}
  </p>
)
const work: PreparedScene = { intent: "work", ask: "Show me the work", line: "Three things I'm proud of, newest first.", blocks: [{ block: "statement", title: "A booking tool for a small clinic, built in six weeks." }], asks: ["Who are you?"] }
const about: PreparedScene = { intent: "about", ask: "Who are you?", line: "I make calm software for small teams.", blocks: [{ block: "statement", title: "Designer and builder." }] }

const meta = {
  title: "Living/PreparedScene",
  component: PreparedSceneView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "One prepared scene as a finished, static page: its ask as the heading, the spoken line, the blocks, and the next asks as links to their routes. It needs no script and no model to read, so it is indexable." } },
  },
  args: { scene: work, scenes: [work, about], speaker: { kind: "person", name: "Alee" }, registry: createRegistry({ statement: Statement }) },
  decorators: [(Story) => <main data-slot="story">{Story()}</main>],
} satisfies Meta<typeof PreparedSceneView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReducedMotion: Story = { decorators: [(Story) => <div data-motion="reduced">{Story()}</div>] }
