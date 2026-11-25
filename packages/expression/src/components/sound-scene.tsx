import * as React from "react"
import type { Mixer } from "../core/audio"
import { allows, loudnessOf } from "../core/loudness"
import { onReducedMotionChange } from "../core/motion"
import { pointerEffectsAllowed } from "../core/pointer"
import { useSoundMixer } from "./sound-hooks"

export interface SoundSceneProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The section's loop (a URL, fetched only once sound is on). */
  src: string
  /** The loop's level when the section fills the view, 0..1 (default 1, on top of the bed bus). */
  volume?: number
  mixer?: Mixer
  children?: React.ReactNode
}

/** The share of the view (or of the section, when it is shorter) the section fills, 0..1. */
export function presence(entry: Pick<IntersectionObserverEntry, "intersectionRect" | "boundingClientRect" | "rootBounds">): number {
  const view = entry.rootBounds?.height ?? (typeof window === "undefined" ? 0 : window.innerHeight)
  const box = Math.min(entry.boundingClientRect.height, view || entry.boundingClientRect.height)
  if (!(box > 0)) return 0
  return Math.min(1, Math.max(0, entry.intersectionRect.height / box))
}

/** Silent until a quarter is in view, full from three quarters, eased between. */
export function sceneLevel(share: number): number {
  const t = Math.min(1, Math.max(0, (share - 0.25) / 0.5))
  return t * t * (3 - 2 * t)
}

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)
/** How long a level change takes (ms): calm enough to read as the room changing, not a cut. */
const FADE = 400

/**
 * SoundScene: a section with its own loop. The loop fades in while the section is mostly in view and out as it
 * leaves. It runs only when the person has turned sound on, on a fine pointer (desktop), with motion allowed and at
 * loudness 2 or more; otherwise only the children render, in the same wrapper, so the layout never changes. The
 * page's SoundToggle (in the nav) is the one mute.
 */
export function SoundScene({ src, volume = 1, mixer, children, ...rest }: SoundSceneProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const m = useSoundMixer(mixer)
  const [active, setActive] = React.useState(false)

  React.useEffect(() => {
    const check = () => {
      const el = ref.current
      setActive(m.supported && m.preference.state === "on" && pointerEffectsAllowed(el) && allows(loudnessOf(el), "scroll"))
    }
    check()
    const stopPreference = m.preference.subscribe(check)
    const stopMotion = onReducedMotionChange(check)
    return () => {
      stopPreference()
      stopMotion()
    }
  }, [m])

  React.useEffect(() => {
    const el = ref.current
    if (!active || !el || typeof IntersectionObserver === "undefined") return
    void m.load(src, src)
    const loop = m.loop(src, { bus: "bed", volume: 0 })
    const level = Math.min(1, Math.max(0, volume))
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1)
        if (entry) loop.fade(level * sceneLevel(presence(entry)), FADE)
      },
      { threshold: THRESHOLDS },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      loop.stop()
    }
  }, [active, m, src, volume])

  return (
    <div ref={ref} data-slot="sound-scene" data-state={active ? "on" : "off"} {...rest}>
      {children}
    </div>
  )
}
