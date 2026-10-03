import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { Icon } from "./icon"

/*
 * Sonner injects its own unlayered stylesheet (13px text, 24px buttons, a shadow). The `!` modifiers put the system's
 * values on top of it: the type roles, the control frame and shadow level 2. The `toast` motion role (duration and curve)
 * and the focus ring are set in foundation.css, against Sonner's selectors, without `!important` so reduced motion still
 * wins. Sonner decides the enter and exit distances itself, because its stacking depends on them.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Icon icon={CircleCheckIcon} size={16} />,
        info: <Icon icon={InfoIcon} size={16} />,
        warning: <Icon icon={TriangleAlertIcon} size={16} />,
        error: <Icon icon={OctagonXIcon} size={16} />,
        loading: <Icon icon={Loader2Icon} size={16} className="animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-overlay)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-secondary)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans! shadow-2! type-body-sm!",
          title: "type-label! text-fg-primary!",
          description: "type-body-sm! text-fg-secondary!",
          actionButton: "hit-area h-control! rounded-control! bg-primary! px-control! type-label! text-primary-foreground!",
          cancelButton: "hit-area h-control! rounded-control! bg-surface-hover! px-control! type-label! text-fg-primary!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
