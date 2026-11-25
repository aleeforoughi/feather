import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "./label"
import { Switch } from "./switch"

const meta = {
  title: "Atoms/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Use a switch for a setting that takes effect immediately when toggled on or off." } },
  },
  args: { "aria-label": "Toggle" },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
export const Small: Story = { args: { size: "sm", defaultChecked: true } }
export const Disabled: Story = { args: { disabled: true } }

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="airplane" {...args} />
      <Label htmlFor="airplane">Airplane mode</Label>
    </div>
  ),
}

/**
 * Toggle a switch: the thumb travels on the switch role. In a brand that turns overshoot on (the playful personality, the
 * `seed` theme) it springs with a slight overshoot. Toggle quickly and it reverses from where it is.
 */
export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {[
        ["states-wifi", "Wi-Fi", "default", true],
        ["states-sync", "Sync in the background", "default", false],
        ["states-compact", "Compact rows", "sm", false],
      ].map(([id, label, size, on]) => (
        <div key={String(id)} className="flex h-control items-center gap-2">
          <Switch {...args} aria-label={undefined} id={String(id)} size={size as "sm" | "default"} defaultChecked={Boolean(on)} />
          <Label htmlFor={String(id)}>{label}</Label>
        </div>
      ))}
    </div>
  ),
}
