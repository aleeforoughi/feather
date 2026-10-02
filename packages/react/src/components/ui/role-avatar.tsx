import * as React from "react"
import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "./avatar"
import { Badge } from "./badge"

/** What a person or agent is doing right now. */
export type RoleState = "idle" | "working" | "waiting" | "done"

const STATE_LABEL: Record<RoleState, string> = { idle: "Idle", working: "Working", waiting: "Waiting", done: "Done" }
const STATE_DOT: Record<RoleState, string> = {
  idle: "bg-muted-foreground/50",
  working: "bg-success animate-pulse",
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
function RoleAvatar({ title, icon: Icon, emphasis, size = "default", className }: RoleBase & { size?: "default" | "sm" | "lg" }) {
  return (
    <Avatar size={size} title={title} data-slot="role-avatar" data-variant={emphasis ? "emphasis" : "default"} className={cn(emphasis && "ring-2 ring-primary ring-offset-1 ring-offset-background", className)}>
      <AvatarFallback className={cn("text-[10px] font-semibold", emphasis ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
        {Icon ? <Icon aria-hidden className={size === "sm" ? "size-3" : "size-4"} /> : <span aria-hidden>{roleInitials(title)}</span>}
        <span className="sr-only">{title}</span>
      </AvatarFallback>
    </Avatar>
  )
}

/** A compact pill: avatar and title, with an optional tag (e.g. "advisory"). */
function RoleChip({ title, icon, emphasis, tag, className }: RoleBase & { tag?: React.ReactNode }) {
  return (
    <span data-slot="role-chip" data-variant="chip" className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-full border bg-background py-0.5 pr-2.5 pl-0.5 text-xs font-medium", className)}>
      <RoleAvatar title={title} icon={icon} emphasis={emphasis} size="sm" />
      <span className="truncate">{title}</span>
      {tag && <span className="text-[10px] font-normal text-muted-foreground">{tag}</span>}
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
    <div data-slot="role-card" data-variant="card" className={cn("flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground", className)}>
      <RoleAvatar title={title} icon={icon} emphasis={emphasis} size="lg" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {kind && <Badge variant={emphasis ? "default" : "secondary"}>{kind}</Badge>}
        </div>
        {state && (
          <p data-slot="role-state" data-variant={state} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", STATE_DOT[state])} />
            {STATE_LABEL[state]}
          </p>
        )}
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        {stats.length > 0 && <p className="text-xs text-muted-foreground">{stats.join(" · ")}</p>}
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
