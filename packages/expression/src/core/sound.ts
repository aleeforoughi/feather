// Sound, off until the person turns it on (WCAG 1.4.2), with the choice remembered and always one press away. While
// the tab is hidden nothing is audible; it comes back as it was. This holds the preference and plays one looping bed;
// a brand's cues and mixer build on `audible` (wave 3).
import { isHidden, onVisibilityChange } from "./visibility"

export type SoundState = "on" | "off"

export interface SoundPreference {
  /** What the person chose (default "off"). */
  readonly state: SoundState
  /** Whether sound may play right now: on, and the page visible. */
  readonly audible: boolean
  set(state: SoundState): void
  toggle(): void
  /** Called whenever `state` or `audible` changes; returns the unsubscribe. */
  subscribe(listener: (audible: boolean, state: SoundState) => void): () => void
}

export interface SoundPreferenceOptions {
  /** The storage key (default "feather-sound"). */
  key?: string
  storage?: Pick<Storage, "getItem" | "setItem"> | null
}

export function createSoundPreference({ key = "feather-sound", storage }: SoundPreferenceOptions = {}): SoundPreference {
  let store: Pick<Storage, "getItem" | "setItem"> | null = null
  try {
    store = storage !== undefined ? storage : typeof localStorage === "undefined" ? null : localStorage
  } catch {
    store = null
  }
  let state: SoundState = "off"
  try {
    if (store?.getItem(key) === "on") state = "on"
  } catch {
    // Default off.
  }
  const listeners = new Set<(audible: boolean, state: SoundState) => void>()
  let stopVisibility: (() => void) | null = null
  const notify = () => {
    for (const l of [...listeners]) l(pref.audible, state)
  }
  const pref: SoundPreference = {
    get state() {
      return state
    },
    get audible() {
      return state === "on" && !isHidden()
    },
    set(next) {
      if (next === state) return
      state = next
      try {
        store?.setItem(key, next)
      } catch {
        // Remembered for this page only.
      }
      notify()
    },
    toggle() {
      pref.set(state === "on" ? "off" : "on")
    },
    subscribe(listener) {
      listeners.add(listener)
      stopVisibility ??= onVisibilityChange(notify)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stopVisibility?.()
          stopVisibility = null
        }
      }
    },
  }
  return pref
}

/** The page's one sound preference. */
export const sound: SoundPreference = createSoundPreference()

export interface SoundBed {
  dispose(): void
}

/** Plays one looping bed while the preference is audible, fading in and out (500ms) on the one volume. */
export function playBed(src: string, { preference = sound, volume = 0.4, fade = 500 }: { preference?: SoundPreference; volume?: number; fade?: number } = {}): SoundBed {
  if (typeof Audio === "undefined") return { dispose() {} }
  const audio = new Audio(src)
  audio.loop = true
  audio.preload = "none"
  audio.volume = 0
  let timer: ReturnType<typeof setInterval> | null = null
  const ramp = (to: number, then?: () => void) => {
    if (timer) clearInterval(timer)
    const from = audio.volume
    const steps = Math.max(1, Math.round(fade / 50))
    let i = 0
    timer = setInterval(() => {
      i++
      audio.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps))
      if (i >= steps) {
        if (timer) clearInterval(timer)
        timer = null
        then?.()
      }
    }, 50)
  }
  const apply = (audible: boolean) => {
    if (audible) {
      void audio.play().then(
        () => ramp(volume),
        () => {
          // Not allowed yet (no gesture): it starts on the next change.
        }
      )
    } else if (isHidden()) {
      // Hidden tabs throttle timers: stop at once rather than fade.
      if (timer) clearInterval(timer)
      timer = null
      audio.volume = 0
      audio.pause()
    } else ramp(0, () => audio.pause())
  }
  const stop = preference.subscribe((audible) => apply(audible))
  if (preference.audible) apply(true)
  return {
    dispose() {
      stop()
      if (timer) clearInterval(timer)
      audio.pause()
      audio.src = ""
    },
  }
}
