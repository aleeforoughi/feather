import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code2, Palette, PenLine, Sparkles } from "lucide-react"
import { RoleAvatar, RoleAvatarGroup, RoleCard, RoleChip } from "./role-avatar"

const meta = {
  title: "Molecules/RoleAvatar",
  component: RoleAvatar,
  tags: ["autodocs"],
  parameters: { layout: "padded", docs: { description: { component: "An avatar for a person or agent role: any icon (initials when none), chip and card forms, an optional state dot (idle, working, waiting, done), a meta line and metrics, `emphasis` for a distinct role, and a group with a +n overflow." } } },
} satisfies Meta<typeof RoleAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Avatars: Story = {
  args: { title: "Brand designer", icon: Palette },
  render: () => (
    <div className="flex items-center gap-3">
      <RoleAvatar title="Brand designer" icon={Palette} />
      <RoleAvatar title="Copywriter" />
      <RoleAvatar title="Hero" icon={Sparkles} emphasis />
    </div>
  ),
}

export const Chips: Story = {
  args: { title: "Brand designer" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <RoleChip title="Brand designer" icon={Palette} />
      <RoleChip title="Frontend engineer" icon={Code2} />
      <RoleChip title="Hero" icon={Sparkles} emphasis tag="advisory" />
    </div>
  ),
}

export const Cards: Story = {
  args: { title: "Brand designer" },
  render: () => (
    <div className="grid w-[32rem] gap-3">
      <RoleCard title="Brand designer" icon={Palette} kind="Operational" state="working" meta="Claude Sonnet" metrics={["3 tasks", "12 turns", "$0.40"]} />
      <RoleCard title="Copywriter" icon={PenLine} kind="Operational" state="waiting" />
      <RoleCard title="Frontend engineer" icon={Code2} kind="Operational" state="done" metrics={["1 task"]} />
      <RoleCard title="Hero" icon={Sparkles} emphasis kind="Advisory" state="idle" meta="Dreams up ideas" />
    </div>
  ),
}

export const Group: Story = {
  args: { title: "Brand designer" },
  render: () => (
    <RoleAvatarGroup
      max={4}
      aria-label="Crew"
      roles={[{ title: "Hero", icon: Sparkles, emphasis: true }, { title: "Brand designer", icon: Palette }, { title: "Copywriter", icon: PenLine }, { title: "Frontend engineer", icon: Code2 }, { title: "QA engineer" }, { title: "Backend engineer" }]}
    />
  ),
}
