import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckIcon, ChevronRightIcon, PlayIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"
import { Icon } from "./icon"

const meta = {
  title: "Atoms/Icon",
  component: Icon,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Draws a lucide icon in a pixel-aligned square slot (16, 20, 24 or 32px, or the density's icon slot) and applies the optical registry, so asymmetric glyphs such as play, triangles and chevrons look centered. Icons in components render through Icon.",
      },
    },
  },
  args: { icon: SearchIcon },
} satisfies Meta<typeof Icon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-group text-fg-primary">
      <Icon icon={SearchIcon} size={16} />
      <Icon icon={SearchIcon} size={20} />
      <Icon icon={SearchIcon} size={24} />
      <Icon icon={SearchIcon} size={32} />
    </div>
  ),
}

export const DensitySlot: Story = {
  render: () => (
    <div className="flex items-center gap-group text-fg-primary">
      {(["tight", "default", "spacious"] as const).map((density) => (
        <div key={density} data-density={density} className="flex items-center gap-element">
          <Icon icon={CheckIcon} />
          <span className="type-label">{density}</span>
        </div>
      ))}
    </div>
  ),
}

export const Emphasis: Story = {
  render: () => (
    <div className="flex items-center gap-group">
      <Icon icon={SearchIcon} className="text-fg-primary" />
      <Icon icon={SearchIcon} className="text-fg-secondary" />
      <Icon icon={SearchIcon} className="text-fg-tertiary" />
      <Icon icon={SearchIcon} className="text-fg-disabled" />
    </div>
  ),
}

/** The registry corrects the glyphs in the first row; the second draws the same lucide glyphs bare, for comparison. */
export const OpticalRegistry: Story = {
  render: () => {
    const glyphs = [PlayIcon, TriangleAlertIcon, ChevronRightIcon]
    return (
      <div className="flex flex-col gap-group text-fg-primary">
        <div className="flex items-center gap-group" data-testid="corrected">
          {glyphs.map((Glyph, i) => (
            <span key={i} className="inline-flex size-control items-center justify-center rounded-control bg-surface-subtle">
              <Icon icon={Glyph} size={24} />
            </span>
          ))}
        </div>
        <div className="flex items-center gap-group" data-testid="bare">
          {glyphs.map((Glyph, i) => (
            <span key={i} className="inline-flex size-control items-center justify-center rounded-control bg-surface-subtle">
              <Glyph width={24} height={24} aria-hidden />
            </span>
          ))}
        </div>
      </div>
    )
  },
}
