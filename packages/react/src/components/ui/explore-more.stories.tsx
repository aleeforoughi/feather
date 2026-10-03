import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"
import { ExploreMore } from "./explore-more"

const meta = {
  title: "Organisms/ExploreMore",
  component: ExploreMore,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "More on request. With no topics one button asks for more. With topics a \"More about…\" menu lists them, each asking for more about that topic. Escape closes the menu and returns focus to the button." } },
  },
  args: { onAct: fn(), intent: "see how the forecast was made" },
} satisfies Meta<typeof ExploreMore>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = { args: { label: "Show me the method" } }

export const WithTopics: Story = { args: { topics: ["Audience", "Budget", "Timing"] } }

export const LongText: Story = {
  args: {
    label: "Show me a great deal more detail about how this recommendation was worked out and what it rests on",
    topics: ["A topic with a long name that has to wrap inside the menu instead of overflowing it sideways", "Short"],
  },
}

export const KeyboardExpand: Story = {
  name: "Keyboard: ask for more",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole("button", { name: "see how the forecast was made" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("expand")
  },
}

export const KeyboardTopic: Story = {
  name: "Keyboard: pick a topic",
  args: { topics: ["Audience", "Budget", "Timing"] },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.tab()
    const trigger = body.getByRole("button", { name: "More about…" })
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    const first = await body.findByRole("menuitem", { name: "Audience" })
    await waitFor(() => expect(first).toHaveFocus())
    await userEvent.keyboard("{ArrowDown}")
    await expect(body.getByRole("menuitem", { name: "Budget" })).toHaveFocus()
    await userEvent.keyboard("{Enter}")
    await expect(args.onAct).toHaveBeenCalledWith("expand", "Budget")
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const KeyboardEscape: Story = {
  name: "Keyboard: Escape closes the menu",
  args: { topics: ["Audience", "Budget", "Timing"] },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.tab()
    const trigger = body.getByRole("button", { name: "More about…" })
    await userEvent.keyboard("{Enter}")
    await body.findByRole("menuitem", { name: "Audience" })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(body.queryByRole("menuitem", { name: "Audience" })).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(args.onAct).not.toHaveBeenCalled()
  },
}
