import * as React from "react"
import { getMixer, type AudioSource, type Bus, type Mixer } from "../core/audio"

/** The mixer to use: the one given, else the page's shared one. */
export function useSoundMixer(mixer?: Mixer): Mixer {
  return React.useMemo(() => mixer ?? getMixer(), [mixer])
}

/** Re-renders when the mixer's `audible` changes; returns it. */
export function useMixerAudible(mixer: Mixer): boolean {
  return React.useSyncExternalStore(
    (onChange) => mixer.subscribe(onChange),
    () => mixer.audible,
    () => false,
  )
}

export interface SoundCueOptions {
  /** When the cue sounds: a fine pointer entering the element, or a press (pointer or Enter/Space, never on key
   * repeat). */
  on: "hover" | "press"
  /** The sound, if this hook should register it (a URL, fetched only once sound is on, or an AudioBuffer). */
  src?: AudioSource
  /** Default "ui". */
  bus?: Bus
  volume?: number
  rate?: number
  mixer?: Mixer
}

export type SoundCueProps = Pick<React.DOMAttributes<Element>, "onPointerEnter" | "onPointerDown" | "onKeyDown">

/**
 * A sound on a control, as props to spread on it. It is silent while sound is off, rate-limited by the mixer (five a
 * second per name), never on touch hover and never on key repeat. A cue only adds to what the control already says:
 * its meaning is never only in the sound.
 */
export function useSoundCue(name: string, { on, src, bus = "ui", volume, rate, mixer }: SoundCueOptions): SoundCueProps {
  const m = useSoundMixer(mixer)
  React.useEffect(() => {
    if (src !== undefined) void m.load(name, src)
  }, [m, name, src])
  return React.useMemo<SoundCueProps>(() => {
    const play = () => {
      if (m.audible) m.play(name, { bus, volume, rate })
    }
    if (on === "hover") {
      return {
        onPointerEnter: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") play()
        },
      }
    }
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button === 0) play()
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!e.repeat && (e.key === "Enter" || e.key === " ")) play()
      },
    }
  }, [m, name, on, bus, volume, rate])
}

const muffles = new WeakMap<Mixer, number>()

/** Muffles the page's sound (a low-pass sweep to 100 Hz over 400ms) while `open` is true: overlays, menus and
 * dialogs. Nested overlays hold it until the last one closes. */
export function useMuffleWhile(open: boolean, mixer?: Mixer): void {
  const m = useSoundMixer(mixer)
  React.useEffect(() => {
    if (!open) return
    const held = (muffles.get(m) ?? 0) + 1
    muffles.set(m, held)
    if (held === 1) m.muffle(true)
    return () => {
      const left = Math.max(0, (muffles.get(m) ?? 1) - 1)
      muffles.set(m, left)
      if (left === 0) m.muffle(false)
    }
  }, [open, m])
}
