import * as React from "react"
import { cn } from "../cn"
import { useReducedMotion } from "../hooks"
import { createMixer, getMixer, type Mixer } from "../core/audio"
import { clock } from "../core/clock"
import { playBed, sound as sharedSound, type SoundBed, type SoundPreference } from "../core/sound"
import { useMixerAudible } from "./sound-hooks"

export interface SoundToggleProps {
  /** A looping bed to play while sound is on: on the mixer's bed bus (decoded once, so it loops without a gap), or
   * with playBed without a mixer or when the mixer cannot fetch it. Nothing plays without it. */
  src?: string
  /** The button's accessible name (default "Sound"); its pressed state says on or off. */
  label?: string
  /** Defaults to the mixer's preference, else the page's `sound`. */
  preference?: SoundPreference
  /** The mixer to toggle through. Defaults to the page's shared mixer when the toggle uses the page's `sound`;
   * `null` (or a preference of its own without a mixer) keeps the plain toggle and playBed. */
  mixer?: Mixer | null
  className?: string
}

const BARS = [0.45, 1, 0.7, 0.9] as const
/** Below this the analyser is read as silence, and the bars rest at their "on" heights. */
const SIGNAL = 0.02
/** Stands in for "no mixer", so the audible subscription is unconditional. */
const noMixer: Mixer = createMixer({ context: null, target: null })

/**
 * SoundToggle: the one-press control for sound, off until chosen. A real toggle button (`aria-pressed`), and the one
 * mute: a page that has any sound keeps it always reachable, in the nav (feather-page puts it there when `page.sound`
 * is set). With a mixer it toggles through it, starting the one AudioContext on that press, and its bars follow the
 * mixer's sound (four bands) while it is audible; without one they move on their own. They rest under reduced motion.
 */
export function SoundToggle({ src, label = "Sound", preference: given, mixer: passed, className }: SoundToggleProps) {
  const reduced = useReducedMotion()
  const bars = React.useRef<Array<HTMLSpanElement | null>>([])
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  const mixer = React.useMemo(() => {
    if (passed !== undefined) return passed
    // Only the page's own preference implies the page's own mixer.
    return given === undefined || given === sharedSound ? getMixer() : null
  }, [passed, given])
  const live = mixer?.supported ? mixer : null
  const preference = given ?? mixer?.preference ?? sharedSound

  React.useEffect(() => preference.subscribe(() => force()), [preference])
  // The state may have changed between render and subscription.
  React.useEffect(() => force(), [preference])

  React.useEffect(() => {
    if (!src) return
    if (live) {
      // On the bed bus, so it is ducked and muffled with the rest. A file the mixer cannot fetch or decode (a
      // cross-origin file without CORS) still plays, with playBed.
      const bed = live.loop(src, { bus: "bed" })
      const held: { done: boolean; fallback: SoundBed | null } = { done: false, fallback: null }
      void live.load(src, src).then((ok) => {
        if (!ok && !held.done) held.fallback = playBed(src, { preference })
      })
      return () => {
        held.done = true
        bed.stop()
        held.fallback?.dispose()
      }
    }
    const bed = playBed(src, { preference })
    return () => bed.dispose()
  }, [src, preference, live])

  const on = preference.state === "on"
  const mixerAudible = useMixerAudible(live ?? noMixer)
  const audible = live ? mixerAudible : preference.audible

  // With a mixer, the bars are the sound: four bands on the one clock, while audible.
  React.useEffect(() => {
    if (!live || !audible || reduced) return
    const read = live.bands(BARS.length)
    const els = bars.current
    const remove = clock.add(() => {
      const bands = read()
      const signal = bands.some((b) => b > SIGNAL)
      els.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${(signal ? 0.25 + 0.75 * (bands[i] ?? 0) : BARS[i]!).toFixed(3)})`
      })
    })
    return () => {
      remove()
      els.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${BARS[i]})`
      })
    }
  }, [live, audible, reduced])

  React.useEffect(() => {
    if (live || !audible || reduced) return
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
  }, [live, audible, reduced])

  return (
    <button
      type="button"
      data-slot="sound-toggle"
      data-state={on ? "on" : "off"}
      aria-pressed={on}
      aria-label={label}
      onClick={() => (live && live.preference === preference ? live.toggle() : preference.toggle())}
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
