import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import type { Block } from "../core/blocks"
import type { Turn } from "../core/conversation"
import { createRegistry } from "../core/registry"
import { LivingTurn } from "./turn"

const Statement = ({ block }: { block: Block }) => (
  <section data-slot="story-block" aria-label={String(block.title)} className="rounded-card border border-line-secondary bg-surface-raised p-6">
    <h3 data-slot="story-block" className="type-label text-fg-primary">
      {String(block.title)}
    </h3>
    <p data-slot="story-block" className="type-body text-fg-secondary">
      {String(block.body ?? "")}
    </p>
  </section>
)
const registry = createRegistry({ statement: Statement })

const done: Turn = {
  id: "turn-1",
  ask: "How do you work with small teams?",
  phase: null,
  words: ["I start ", "with the ", "smallest thing ", "that could be true, ", "then I show it."],
  blocks: [{ block: "statement", title: "Weekly, in the open", body: "A short note every Friday, and a link you can click." }],
  asks: ["What does it cost?", "Show me the work"],
  status: "done",
  error: null,
  folded: false,
  prepared: false,
}

const meta = {
  title: "Living/Turn",
  component: LivingTurn,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "One exchange, expanded in place: the visitor's words as a quiet caption, the speaker's byline, a named phase while it thinks, the spoken line revealed word by word, one to three blocks from the page's library, and the next asks. A finished turn folds to a one-line receipt that reopens." } },
  },
  args: { turn: done, speaker: { kind: "person", name: "Alee" }, registry, onAsk: fn(), onFold: fn() },
} satisfies Meta<typeof LivingTurn>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Thinking: Story = { args: { turn: { ...done, status: "thinking", phase: "Looking through the work", words: [], blocks: [], asks: [] } } }
export const Speaking: Story = { args: { turn: { ...done, status: "speaking", blocks: [], asks: [], words: done.words.slice(0, 3) } } }
export const Folded: Story = { args: { turn: { ...done, folded: true } } }
export const Failed: Story = { args: { turn: { ...done, status: "error", words: [], blocks: [], asks: [], error: { message: "I lost the thread.", next: "Ask again, or write to me directly." } } } }
export const ReducedMotion: Story = { decorators: [(Story) => <div data-motion="reduced">{Story()}</div>] }
