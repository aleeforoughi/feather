import type { Meta, StoryObj } from "@storybook/react-vite"
import { ConsequenceStatement } from "./consequence-statement"

const meta = {
  title: "Organisms/ConsequenceStatement",
  component: ConsequenceStatement,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "What an act does, verbatim, before the act. Each entry of an IR consequence is one plain sentence; money is formatted in the locale. Give it an `id` and point the act's `aria-describedby` at it." } } },
  args: { consequence: { spend: { amount: 1050, currency: "AED" } }, className: "w-[28rem]" },
} satisfies Meta<typeof ConsequenceStatement>

export default meta
type Story = StoryObj<typeof meta>

export const Spend: Story = {}

export const EveryKind: Story = {
  args: {
    consequence: {
      spend: { amount: 1050, currency: "AED" },
      publish: { audience: "all 12,400 subscribers" },
      send: { to: "the finance team", channel: "email" },
      consent: { to: "Acme Analytics", scope: "your ad account" },
      delete: { what: "the 2025 campaign archive" },
      statement: "The agency is notified at once.",
    },
  },
}

export const German: Story = { args: { consequence: { spend: { amount: 1050.5, currency: "EUR" } }, locale: "de-DE" } }

export const LongText: Story = {
  args: {
    className: "w-72",
    consequence: {
      publish: { audience: "everyone who follows any of the three regional accounts, including people who joined after the campaign started" },
      statement: "Once published, search engines and partner feeds may keep their own copies for weeks, which Feather cannot recall.",
    },
  },
}
