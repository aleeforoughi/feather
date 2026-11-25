import type { Meta, StoryObj } from "@storybook/react-vite"
import { DisplayTitle } from "./display-title"

const meta = {
  title: "Website/DisplayTitle",
  component: DisplayTitle,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Display type in seven entrances: rise, mask, skew, oval, blink, scramble and swap. Screen readers get the whole text once; the visual pieces are hidden from them. Every sequence ends within 1.2s (oval within 1.8s). Under reduced motion it is plain text, and scramble and swap show their final text and first word." } },
  },
  args: { children: "Design that answers to the person", as: "h1", size: "xl" },
  decorators: [(Story) => <div data-slot="story-page" className="page-grid bg-surface-base py-12"><div className="col-span-full"><Story /></div></div>],
} satisfies Meta<typeof DisplayTitle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ByLine: Story = { args: { split: "line", size: "l", as: "h2" } }
export const ByCharacter: Story = { args: { split: "char", size: "m", as: "h2" } }
export const Whole: Story = { args: { split: "none", size: "s", as: "h2" } }
const hero = { as: "h1", size: "xl" } as const
export const Rise: Story = { args: { effect: "rise", ...hero } }
export const Mask: Story = { args: { effect: "mask", children: "Quiet systems for loud ideas, cut line by line", ...hero } }
export const MaskByWord: Story = { args: { effect: "mask", split: "word", children: "Every word earns its place", ...hero } }
export const Skew: Story = { args: { effect: "skew", children: "Made with care", ...hero }, parameters: { docs: { description: { story: "Plays from 992px up. Narrower, or under reduced motion, it is the mask." } } } }
export const Oval: Story = { args: { effect: "oval", children: "The room opens as you arrive", ...hero }, parameters: { docs: { description: { story: "The one long reveal: 1.5s a line, the whole sequence within 1.8s." } } } }
export const Blink: Story = { args: { effect: "blink", children: "Cut to the work", ...hero } }
export const Scramble: Story = { args: { effect: "scramble", children: "Signal from the studio", ...hero } }
export const Swap: Story = {
  args: { effect: "swap", words: ["calm", "precise", "alive"], children: "Software that feels {word}", ...hero },
  parameters: { docs: { description: { story: "One word changes every 2.4s in a masked swap. It holds on hover and focus, off screen, in a hidden tab, and while `paused` is set by the host's pause control." } } },
}
export const SwapOnLoad: Story = { args: { effect: "swap", trigger: "load", interval: 3000, words: ["design", "build", "ship"], children: "We {word} things people keep", size: "l", as: "h2" } }
export const ReducedMotion: Story = { render: (args) => <div data-motion="reduced"><DisplayTitle {...args} /></div>, args: { effect: "mask", words: undefined } }
