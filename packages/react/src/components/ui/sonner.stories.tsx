import type { Meta, StoryObj } from "@storybook/react-vite"
import { toast } from "sonner"
import { Button } from "./button"
import { Toaster } from "./sonner"

const meta = {
  title: "Atoms/Sonner",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use toasts for brief, non-blocking feedback after an action; the Toaster is already mounted by the foundation providers." } },
  },
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Button variant="outline" onClick={() => toast("Event created", { description: "Friday at 9:00 AM" })}>Show toast</Button>,
}

export const Success: Story = {
  render: () => <Button variant="outline" onClick={() => toast.success("Changes saved")}>Success</Button>,
}

export const Error: Story = {
  render: () => <Button variant="outline" onClick={() => toast.error("Could not save changes")}>Error</Button>,
}

export const WithAction: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() => toast("Message archived", { action: { label: "Undo", onClick: () => toast.info("Restored") } })}
    >
      With action
    </Button>
  ),
}
