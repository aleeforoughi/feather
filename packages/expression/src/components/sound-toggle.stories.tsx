import type { Meta, StoryObj } from "@storybook/react-vite"
import { createSoundPreference } from "../core/sound"
import { SoundToggle } from "./sound-toggle"

const meta = {
  title: "Website/SoundToggle",
  component: SoundToggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "SoundToggle is the one-press control for sound. It is off until the person turns it on, the choice is remembered, and it is a real toggle button. The bars move while sound is audible and rest under reduced motion.",
      },
    },
  },
  args: { label: "Sound" },
} satisfies Meta<typeof SoundToggle>

export default meta
type Story = StoryObj<typeof meta>

const Bar = ({ children }: { children: React.ReactNode }) => (
  <header data-slot="story-header" className="flex h-16 items-center justify-between border-b border-line-primary bg-surface-base px-6 text-fg-primary">
    <span className="type-title">Studio of One</span>
    {children}
  </header>
)

export const Off: Story = { render: (args) => <Bar><SoundToggle {...args} preference={createSoundPreference({ storage: null })} /></Bar> }

const on = createSoundPreference({ storage: null })
on.set("on")
export const On: Story = { render: (args) => <Bar><SoundToggle {...args} preference={on} /></Bar> }

export const WithBed: Story = {
  args: { src: "/bed.mp3" },
  render: (args) => <Bar><SoundToggle {...args} preference={createSoundPreference({ storage: null })} /></Bar>,
}

export const ReducedMotion: Story = {
  render: (args) => (
    <div data-motion="reduced">
      <Bar><SoundToggle {...args} preference={on} /></Bar>
    </div>
  ),
}
