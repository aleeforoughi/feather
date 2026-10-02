import type { Meta, StoryObj } from "@storybook/react-vite"
import { Progress, ProgressLabel, ProgressValue } from "./progress"

const meta = {
  title: "Atoms/Progress",
  component: Progress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Use progress to show how far along a task with a known length has come." } },
  },
  args: { value: 60, className: "w-72" },
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = { args: { value: 0 } }

export const Complete: Story = { args: { value: 100 } }

export const WithLabel: Story = {
  args: {
    value: 45,
    children: (
      <>
        <ProgressLabel>Uploading</ProgressLabel>
        <ProgressValue className="ml-auto" />
      </>
    ),
  },
}

export const Indeterminate: Story = { args: { value: null } }
