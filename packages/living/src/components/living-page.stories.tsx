import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Block } from "../core/blocks"
import type { TurnEvent } from "../core/conversation"
import type { PreparedScene } from "../core/prepared"
import { createRegistry } from "../core/registry"
import { LivingPage, type AskHandler } from "./living-page"

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

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A fake host: no network, no model. It streams a scripted answer with small awaits and honors the abort signal.
const onAsk: AskHandler = async function* (ask, { signal }): AsyncGenerator<TurnEvent> {
  yield { type: "phase", label: "Reading the page" }
  await pause(400)
  const line = `You asked "${ask}". I keep my answers short: one idea, one example, and a way to go further.`.split(/(?=\s)/)
  for (const text of line) {
    if (signal.aborted) return
    await pause(60)
    yield { type: "word", text }
  }
  yield { type: "block", block: { block: "statement", title: "One idea, one example", body: "This block comes from the page's own library, so it looks like it was always here." } }
  yield { type: "asks", asks: ["Show me the work", "What does it cost?"] }
  yield { type: "done" }
}

const prepared: PreparedScene[] = [
  { intent: "work", ask: "Show me the work", line: "Here is the work I'd show a friend first.", blocks: [{ block: "statement", title: "A booking tool for a small clinic", body: "Built in six weeks, still in daily use." }], asks: ["What does it cost?"] },
]

const Section = ({ id, title, children }: { id: string; title: string; children: string }) => (
  <section data-living-section={id} aria-labelledby={`story-${id}`} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-24">
    {id === "hero" ? (
      <h1 id={`story-${id}`} data-slot="story-section" className="type-display-l text-fg-primary">
        {title}
      </h1>
    ) : (
      <h2 id={`story-${id}`} data-slot="story-section" className="type-display-m text-fg-primary">
        {title}
      </h2>
    )}
    <p data-slot="story-section" className="type-body text-fg-secondary">
      {children}
    </p>
  </section>
)

const meta = {
  title: "Living/LivingPage",
  component: LivingPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "The whole website, complete before anyone types. Ask anything below and the answer opens in place, right after the section you are reading, built from the page's own blocks; Stop ends it, Back to the page folds it away. The story's host is a script, not a model. \"Show me the work\" is a prepared scene and plays at once." } },
  },
  args: {
    speaker: { kind: "person", name: "Alee" },
    registry,
    prepared,
    onAsk,
    children: (
      <main data-slot="story">
        <Section id="hero" title="I make calm software.">
          Small teams, clear tools, and a Friday note about what changed.
        </Section>
        <Section id="work" title="Work">
          A clinic booking tool, a field-notes app, and a library for a design studio.
        </Section>
        <Section id="contact" title="Contact">
          Write to me, or ask below.
        </Section>
      </main>
    ),
  },
} satisfies Meta<typeof LivingPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReducedMotion: Story = { decorators: [(Story) => <div data-motion="reduced">{Story()}</div>] }
