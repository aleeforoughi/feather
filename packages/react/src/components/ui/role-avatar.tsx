import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/cn"

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "./avatar"
import { Badge } from "./badge"
import { Icon } from "./icon"

/** What a person or agent is doing right now. */
export type RoleState = "idle" | "working" | "waiting" | "done"

const STATE_LABEL: Record<RoleState, string> = { idle: "Idle", working: "Working", waiting: "Waiting", done: "Done" }
const STATE_DOT: Record<RoleState, string> = {
  idle: "bg-fg-tertiary",
  working: "bg-success motion-loading",
  waiting: "bg-warning",
  done: "bg-primary",
}

/** Up to two initials from a title ("Brand designer" -> "BD"). */
function roleInitials(title: string): string {
  const words = title.split(/[\s_]+/).filter(Boolean)
  if (words.length === 0) return "?"
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")
}

/** How many avatars show and how many collapse into "+n". */
function overflow(total: number, max: number): { shown: number; extra: number } {
  const shown = Math.max(0, Math.min(total, max))
  return { shown, extra: total - shown }
}

type RoleBase = {
  /** Display title, e.g. "Brand designer". Also gives the initials fallback. */
  title: string
  /** Any icon component (e.g. from lucide-react); initials show when omitted. */
  icon?: React.ElementType<{ className?: string; "aria-hidden"?: boolean }>
  /** A distinct role: ringed and in the primary color. */
  emphasis?: boolean
  className?: string
}

/** The role's avatar: an icon (or initials) on a soft background; `emphasis` rings it in the primary color. */
function RoleAvatar({ title, icon: Glyph, emphasis, size = "default", className }: RoleBase & { size?: "default" | "sm" | "lg" }) {
  return (
    <Avatar size={size} title={title} data-slot="role-avatar" data-variant={emphasis ? "emphasis" : "default"} className={cn(emphasis && "ring-2 ring-primary ring-offset-1 ring-offset-background", className)}>
      <AvatarFallback className={cn(emphasis ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-fg-primary")}>
        {Glyph ? <Icon icon={Glyph as LucideIcon} size={size === "lg" ? 20 : 16} aria-hidden /> : <span data-slot="role-avatar-initials" aria-hidden className="type-caps">{roleInitials(title)}</span>}
        <span data-slot="role-avatar-title" className="sr-only">{title}</span>
      </AvatarFallback>
    </Avatar>
  )
}

/** A compact pill: avatar and title, with an optional tag (e.g. "advisory"). */
function RoleChip({ title, icon, emphasis, tag, className }: RoleBase & { tag?: React.ReactNode }) {
  return (
    <span data-slot="role-chip" data-variant="chip" className={cn("inline-flex min-w-0 items-center gap-2 rounded-full border border-line-secondary bg-surface-base py-1 pr-3 pl-1 type-label text-fg-primary", className)}>
      <RoleAvatar title={title} icon={icon} emphasis={emphasis} size="sm" />
      <span data-slot="role-chip-title" className="truncate">{title}</span>
      {tag && <span data-slot="role-chip-tag" className="type-caption text-fg-secondary">{tag}</span>}
    </span>
  )
}

/** A card: avatar, title, kind badge, state, an optional meta line (e.g. the model) and metrics. */
function RoleCard({ title, icon, emphasis, kind, state, meta, metrics, className }: RoleBase & {
  /** Short label for the badge, e.g. "Advisory" or "Operational". */
  kind?: string
  state?: RoleState
  /** A muted line, e.g. the model behind an agent or an email. */
  meta?: React.ReactNode
  /** Short facts joined with " · ", e.g. ["3 tasks", "$0.40"]. */
  metrics?: Array<string | false | null | undefined>
}) {
  const stats = (metrics ?? []).filter(Boolean)
  return (
    <div data-slot="role-card" data-variant="card" className={cn("flex items-start gap-element rounded-card border border-line-secondary bg-card p-card text-fg-primary", className)}>
      <RoleAvatar title={title} icon={icon} emphasis={emphasis} size="lg" />
      <div data-slot="role-card-body" className="min-w-0 flex-1 space-y-1">
        <div data-slot="role-card-heading" className="flex flex-wrap items-center gap-2">
          <span data-slot="role-card-title" className="truncate type-label">{title}</span>
          {kind && <Badge variant={emphasis ? "default" : "secondary"}>{kind}</Badge>}
        </div>
        {state && (
          <p data-slot="role-state" data-variant={state} className="flex items-center gap-2 type-caption text-fg-secondary">
            <span data-slot="role-state-dot" aria-hidden className={cn("size-2 rounded-full", STATE_DOT[state])} />
            {STATE_LABEL[state]}
          </p>
        )}
        {meta && <p data-slot="role-card-meta" className="type-caption text-fg-secondary">{meta}</p>}
        {stats.length > 0 && <p data-slot="role-card-metrics" className="type-caption text-fg-secondary">{stats.join(" · ")}</p>}
      </div>
    </div>
  )
}

/** Overlapping avatars; members past `max` collapse into a "+n". */
function RoleAvatarGroup({ roles, max = 6, className, ...props }: { roles: Array<Pick<RoleBase, "title" | "icon" | "emphasis">>; max?: number } & Omit<React.ComponentProps<typeof AvatarGroup>, "children">) {
  const { shown, extra } = overflow(roles.length, max)
  return (
    <AvatarGroup data-slot="role-avatar-group" className={className} {...props}>
      {roles.slice(0, shown).map((r) => <RoleAvatar key={r.title} {...r} />)}
      {extra > 0 && <AvatarGroupCount>+{extra}</AvatarGroupCount>}
    </AvatarGroup>
  )
}

export { RoleAvatar, RoleAvatarGroup, RoleCard, RoleChip, overflow, roleInitials }
