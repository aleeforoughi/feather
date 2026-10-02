import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta = {
  title: "Atoms/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use tabs to switch between related views of the same content without leaving the page." } },
  },
  args: { defaultValue: "overview" },
  render: (args) => (
    <Tabs {...args} className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">A summary of everything happening in your workspace.</TabsContent>
      <TabsContent value="activity" className="text-sm text-muted-foreground">Recent changes made by you and your team.</TabsContent>
      <TabsContent value="settings" className="text-sm text-muted-foreground">Preferences for notifications and access.</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Line: Story = {
  render: (args) => (
    <Tabs {...args} className="w-96">
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">A summary of everything happening in your workspace.</TabsContent>
      <TabsContent value="activity" className="text-sm text-muted-foreground">Recent changes made by you and your team.</TabsContent>
      <TabsContent value="settings" className="text-sm text-muted-foreground">Preferences for notifications and access.</TabsContent>
    </Tabs>
  ),
}

export const Vertical: Story = {
  args: { orientation: "vertical" },
}

export const DisabledTab: Story = {
  render: (args) => (
    <Tabs {...args} className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="billing" disabled>Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">Billing is unavailable on the free plan.</TabsContent>
    </Tabs>
  ),
}
