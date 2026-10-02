import type { Meta, StoryObj } from "@storybook/react-vite"
import { CircleAlert, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "./alert"
import { Button } from "./button"

const meta = {
  title: "Atoms/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: "Use an alert to surface a persistent, in-context message such as a status update or a recoverable error." } },
  },
  render: (args) => (
    <Alert {...args} className="max-w-md">
      <Info />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your changes are saved automatically every few seconds.</AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args} className="max-w-md">
      <CircleAlert />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>Your card was declined. Check the details and try again.</AlertDescription>
    </Alert>
  ),
}

export const WithButton: Story = {
  render: (args) => (
    <div className="flex max-w-md flex-col gap-3">
      <Alert {...args}>
        <Info />
        <AlertTitle>Trial ending soon</AlertTitle>
        <AlertDescription>Your trial ends in three days.</AlertDescription>
      </Alert>
      <Button size="sm" className="w-fit">Upgrade now</Button>
    </div>
  ),
}
