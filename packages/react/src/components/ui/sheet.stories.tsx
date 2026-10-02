import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"

const meta = {
  title: "Atoms/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a sheet for a secondary task or detail panel that slides in from the edge without leaving the page." } },
  },
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Make changes to your profile here.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <Label htmlFor="sheet-name">Name</Label>
          <Input id="sheet-name" defaultValue="Jordan Lee" />
        </div>
        <SheetFooter>
          <Button>Save changes</Button>
          <SheetClose render={<Button variant="outline" />}>Close</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof Sheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenOnLoad: Story = { args: { defaultOpen: true } }

function sideStory(side: "top" | "right" | "bottom" | "left"): Story {
  return {
    render: (args) => (
      <Sheet {...args}>
        <SheetTrigger render={<Button variant="outline" />}>Open {side}</SheetTrigger>
        <SheetContent side={side}>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>You have no new notifications.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    ),
  }
}

export const Left: Story = sideStory("left")
export const Top: Story = sideStory("top")
export const Bottom: Story = sideStory("bottom")
