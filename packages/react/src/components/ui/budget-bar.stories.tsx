import type { Meta, StoryObj } from "@storybook/react-vite"
import { BudgetBar } from "./budget-bar"

const meta = {
  title: "Molecules/BudgetBar",
  component: BudgetBar,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "A budget meter: fill is the amount used, with optional target and cap markers and a striped reserved segment. Zones ok, warm, hot and over use the success, warning and destructive tokens. Pass `format` for currency, bytes or counts." } } },
  decorators: [(Story) => <div className="w-96"><Story /></div>],
} satisfies Meta<typeof BudgetBar>

export default meta
type Story = StoryObj<typeof meta>

const usd = (n: number) => `$${n.toFixed(2)}`

export const Ok: Story = { args: { spent: 0.4, target: 1, cap: 2, format: usd, label: "Spend" } }
export const Warm: Story = { args: { spent: 1.2, target: 1, cap: 2, format: usd } }
export const Hot: Story = { args: { spent: 1.8, target: 1, cap: 2, format: usd } }
export const Over: Story = { args: { spent: 2.6, target: 1, cap: 2, format: usd } }
export const WithReserved: Story = { args: { spent: 0.6, reserved: 0.5, target: 1, cap: 2, format: usd } }
export const Storage: Story = { args: { spent: 42, cap: 100, format: (n: number) => `${n} GB`, label: "Storage" } }
export const Mini: Story = { args: { spent: 1.5, target: 1, cap: 2, size: "mini", format: usd } }
