import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { playBed, sound as sharedSound, type SoundPreference } from "../core/sound"

export interface SoundToggleProps {
  /** A looping bed to play while sound is on (played with playBed; nothing plays without it). */
  src?: string
  /** The button's accessible name (default "Sound"); its pressed state says on or off. */
  label?: string
  preference?: SoundPreference
  className?: string
}

const BARS = [0.45, 1, 0.7, 0.9] as const

/**
 * SoundToggle: the one-press control for sound, off until chosen. A real toggle button; its bars move while sound is
 * audible and rest under reduced motion.
 */
export function SoundToggle({ src, label = "Sound", preference = sharedSound, className }: SoundToggleProps) {
  const reduced = useReducedMotion()
  const bars = React.useRef<Array<HTMLSpanElement | null>>([])
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  React.useEffect(() => preference.subscribe(() => force()), [preference])
  // The state may have changed between render and subscription.
  React.useEffect(() => force(), [preference])

  React.useEffect(() => {
    if (!src) return
    const bed = playBed(src, { preference })
    return () => bed.dispose()
  }, [src, preference])

  const on = preference.state === "on"
  const audible = preference.audible

  React.useEffect(() => {
    if (!audible || reduced) return
    const running: Animation[] = []
    bars.current.forEach((bar, i) => {
      if (!bar || typeof bar.animate !== "function") return
      running.push(
        bar.animate([{ transform: `scaleY(${BARS[i]})` }, { transform: "scaleY(0.35)" }, { transform: `scaleY(${BARS[i]})` }], {
          duration: 900 + i * 170,
          delay: -i * 230,
          iterations: Infinity,
          easing: "cubic-bezier(0.45, 0, 0.55, 1)",
        }),
      )
    })
    return () => running.forEach((a) => a.cancel())
  }, [audible, reduced])

  return (
    <button
      type="button"
      data-slot="sound-toggle"
      data-state={on ? "on" : "off"}
      aria-pressed={on}
      aria-label={label}
      onClick={() => preference.toggle()}
      className={cn("inline-flex min-h-12 min-w-12 items-center justify-center rounded-control text-fg-primary focus-ring motion-hover-out not-disabled:hover:bg-surface-hover", className)}
    >
      <span data-slot="sound-toggle-bars" aria-hidden="true" className="flex h-5 items-center gap-1">
        {BARS.map((height, i) => (
          <span
            key={i}
            ref={(el) => {
              bars.current[i] = el
            }}
            data-slot="sound-toggle-bar"
            className={cn("block h-full w-1 origin-center rounded-full bg-current", on ? "" : "text-fg-secondary")}
            style={{ transform: `scaleY(${on ? height : 0.2})` }}
          />
        ))}
      </span>
    </button>
  )
}
