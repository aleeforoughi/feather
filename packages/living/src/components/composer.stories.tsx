import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Composer } from "./composer"

const meta = {
  title: "Living/Composer",
  component: Composer,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: { description: { component: "The one input of a Living Page. It says it is an AI agent before the first word, grows from one line to 192px at 16px text, sends with Enter (Shift+Enter adds a line, an IME composition never sends), and Send turns into Stop in the same place." } },
  },
  args: { speaker: { kind: "person", name: "Alee" }, onSend: fn(), onStop: fn(), starters: ["Show me the work", "How do you work?"] },
} satisfies Meta<typeof Composer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Streaming: Story = { args: { streaming: true } }
export const Company: Story = { args: { speaker: { kind: "company", name: "Godpip" }, starters: undefined } }
export const ReducedMotion: Story = { decorators: [(Story) => <div data-motion="reduced">{Story()}</div>] }
