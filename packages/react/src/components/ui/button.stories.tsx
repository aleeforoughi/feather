import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ArrowRight, Mail } from "lucide-react"
import { Button } from "./button"
import { FieldSuccess } from "./field"

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a button to trigger an action; choose the variant by how much emphasis the action deserves." } },
  },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "ghost", "destructive", "link"] },
    size: { control: "select", options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] },
  },
  args: { children: "Button" },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Outline: Story = { args: { variant: "outline" } }
export const Ghost: Story = { args: { variant: "ghost" } }
export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } }
export const Link: Story = { args: { variant: "link" } }
export const Small: Story = { args: { size: "sm" } }
export const Large: Story = {
  args: {
    size: "lg",
    children: (
      <>
        Continue <ArrowRight />
      </>
    ),
  },
}
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Mail /> Send email
      </>
    ),
  },
}
export const IconOnly: Story = { args: { size: "icon", "aria-label": "Send email", children: <Mail /> } }
export const Disabled: Story = { args: { disabled: true } }

/** Save runs the whole micro-motion: press, a spinner in a box that keeps its size, then a check that draws, announced. */
function SaveFlow() {
  const [state, setState] = useState<"idle" | "loading" | "saved">("idle")
  const save = () => {
    setState("loading")
    window.setTimeout(() => setState("saved"), 1200)
  }
  return (
    <div className="flex items-center gap-4">
      <Button loading={state === "loading"} onClick={save}>
        Save changes
      </Button>
      <FieldSuccess>{state === "saved" ? "Saved" : null}</FieldSuccess>
    </div>
  )
}

/**
 * Every micro-motion a button has. Press any button (it scales 0.985 in 100ms and springs back), hover it (its surface
 * eases), Tab to it (the ring appears without moving anything), and press Save to watch loading turn into success.
 */
export const States: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete</Button>
        <Button size="icon" variant="outline" aria-label="Send email">
          <Mail />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button loading>Default</Button>
        <Button loading variant="outline">
          <Mail /> Outline
        </Button>
        <Button loading variant="ghost">Ghost</Button>
      </div>
      <SaveFlow />
    </div>
  ),
}
