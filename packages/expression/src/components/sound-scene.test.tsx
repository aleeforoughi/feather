import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Mixer } from "../core/audio"
import { createSoundPreference } from "../core/sound"
import { mockMedia, REDUCED } from "../test/helpers"
import { useMuffleWhile, useSoundCue } from "./sound-hooks"
import { presence, SoundScene, sceneLevel } from "./sound-scene"
import { SoundToggle } from "./sound-toggle"

const FINE = "pointer: fine"

/** A stand-in mixer: records what the components ask of it. */
function stubMixer({ on = false, audible = on, bands = [0.5, 0.5, 0.5, 0.5] }: { on?: boolean; audible?: boolean; bands?: number[] } = {}) {
  const preference = createSoundPreference({ storage: null })
  if (on) preference.set("on")
  const handle = { volume: 0, fade: vi.fn(), stop: vi.fn() }
  const listeners = new Set<(a: boolean) => void>()
  let isAudible = audible
  const mixer = {
    supported: true,
    preference,
    started: true,
    get audible() {
      return isAudible
    },
    toggle: vi.fn(() => preference.toggle()),
    unlock: vi.fn(),
    load: vi.fn(() => Promise.resolve(true)),
    play: vi.fn(() => true),
    loop: vi.fn(() => handle),
    duck: vi.fn(() => () => {}),
    muffle: vi.fn(),
    bands: vi.fn(() => () => bands),
    subscribe: (l: (a: boolean) => void) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    dispose: vi.fn(),
  }
  const setAudible = (a: boolean) => {
    isAudible = a
    for (const l of listeners) l(a)
  }
  return { mixer: mixer as unknown as Mixer & typeof mixer, handle, setAudible }
}

let observers: Array<{ callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = []
beforeEach(() => {
  observers = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn()
      disconnect = vi.fn()
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        observers.push(this)
      }
    },
  )
})
afterEach(() => {
  mockMedia([])
  vi.unstubAllGlobals()
})

const entry = (visible: number, box = 1000, view = 800) =>
  ({ intersectionRect: { height: visible }, boundingClientRect: { height: box }, rootBounds: { height: view } }) as unknown as IntersectionObserverEntry

describe("SoundScene", () => {
  const scene = (mixer: Mixer, loudness = "2") =>
    render(
      <div data-loudness={loudness}>
        <SoundScene src="/hall.mp3" volume={0.8} mixer={mixer}>
          <h2>Hall</h2>
        </SoundScene>
      </div>,
    )

  it("fades its loop by how much of the view the section fills, and stops it on unmount", () => {
    mockMedia([FINE])
    const { mixer, handle } = stubMixer({ on: true })
    const { unmount } = scene(mixer)
    expect(screen.getByRole("heading", { name: "Hall" })).toBeTruthy()
    expect(mixer.load).toHaveBeenCalledWith("/hall.mp3", "/hall.mp3")
    expect(mixer.loop).toHaveBeenCalledWith("/hall.mp3", { bus: "bed", volume: 0 })
    const io = observers[0]!
    act(() => io.callback([entry(800)], io as unknown as IntersectionObserver))
    expect(handle.fade).toHaveBeenLastCalledWith(0.8, 400)
    act(() => io.callback([entry(400)], io as unknown as IntersectionObserver))
    expect(handle.fade).toHaveBeenLastCalledWith(0.4, 400)
    act(() => io.callback([entry(100)], io as unknown as IntersectionObserver))
    expect(handle.fade).toHaveBeenLastCalledWith(0, 400)
    unmount()
    expect(handle.stop).toHaveBeenCalled()
    expect(io.disconnect).toHaveBeenCalled()
  })

  it("starts and stops with the preference", () => {
    mockMedia([FINE])
    const { mixer, handle } = stubMixer()
    scene(mixer)
    expect(mixer.loop).not.toHaveBeenCalled()
    act(() => mixer.preference.set("on"))
    expect(mixer.loop).toHaveBeenCalledTimes(1)
    act(() => mixer.preference.set("off"))
    expect(handle.stop).toHaveBeenCalled()
  })

  const silent: Array<[string, string[], string, boolean]> = [
    ["sound is off", [FINE], "2", false],
    ["the pointer is touch", [], "2", true],
    ["motion is reduced", [FINE, REDUCED], "2", true],
    ["loudness is below 2", [FINE], "1", true],
  ]
  for (const [why, media, loudness, on] of silent) {
    it(`renders only its children when ${why}`, () => {
      mockMedia(media)
      const { mixer } = stubMixer({ on })
      const { container } = scene(mixer, loudness)
      expect(screen.getByRole("heading", { name: "Hall" })).toBeTruthy()
      expect(container.querySelector('[data-slot="sound-scene"]')!.getAttribute("data-state")).toBe("off")
      expect(mixer.load).not.toHaveBeenCalled()
      expect(mixer.loop).not.toHaveBeenCalled()
      expect(observers).toHaveLength(0)
    })
  }

  it("maps presence to a level: silent under a quarter, full from three quarters", () => {
    expect(presence(entry(800))).toBe(1)
    expect(presence(entry(300, 300))).toBe(1)
    expect(presence(entry(0))).toBe(0)
    expect(sceneLevel(0.2)).toBe(0)
    expect(sceneLevel(0.5)).toBe(0.5)
    expect(sceneLevel(0.9)).toBe(1)
  })
})

describe("useSoundCue", () => {
  function Cue({ mixer, on }: { mixer: Mixer; on: "hover" | "press" }) {
    const cue = useSoundCue("tick", { on, src: "/tick.mp3", mixer })
    return (
      <button type="button" {...cue}>
        Go
      </button>
    )
  }

  it("plays on a fine-pointer hover, never on touch", () => {
    const { mixer } = stubMixer({ on: true })
    render(<Cue mixer={mixer} on="hover" />)
    expect(mixer.load).toHaveBeenCalledWith("tick", "/tick.mp3")
    fireEvent.pointerOver(screen.getByRole("button"), { pointerType: "mouse" })
    expect(mixer.play).toHaveBeenCalledWith("tick", { bus: "ui", volume: undefined, rate: undefined })
    mixer.play.mockClear()
    fireEvent.pointerOut(screen.getByRole("button"), { pointerType: "touch" })
    fireEvent.pointerOver(screen.getByRole("button"), { pointerType: "touch" })
    expect(mixer.play).not.toHaveBeenCalled()
  })

  it("plays on a press and on Enter or Space, never on key repeat", () => {
    const { mixer } = stubMixer({ on: true })
    render(<Cue mixer={mixer} on="press" />)
    const button = screen.getByRole("button")
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.keyDown(button, { key: "Enter" })
    fireEvent.keyDown(button, { key: " " })
    expect(mixer.play).toHaveBeenCalledTimes(3)
    fireEvent.keyDown(button, { key: "Enter", repeat: true })
    fireEvent.keyDown(button, { key: "a" })
    fireEvent.pointerDown(button, { button: 2 })
    expect(mixer.play).toHaveBeenCalledTimes(3)
  })

  it("does nothing while sound is off", () => {
    const { mixer } = stubMixer()
    render(<Cue mixer={mixer} on="press" />)
    fireEvent.pointerDown(screen.getByRole("button"), { button: 0 })
    expect(mixer.play).not.toHaveBeenCalled()
  })
})

describe("useMuffleWhile", () => {
  function Overlay({ open, mixer }: { open: boolean; mixer: Mixer }) {
    useMuffleWhile(open, mixer)
    return null
  }

  it("muffles while open, and holds it until the last overlay closes", () => {
    const { mixer } = stubMixer({ on: true })
    const view = render(
      <>
        <Overlay open={false} mixer={mixer} />
        <Overlay open={false} mixer={mixer} />
      </>,
    )
    expect(mixer.muffle).not.toHaveBeenCalled()
    const at = (a: boolean, b: boolean) =>
      view.rerender(
        <>
          <Overlay open={a} mixer={mixer} />
          <Overlay open={b} mixer={mixer} />
        </>,
      )
    at(true, false)
    expect(mixer.muffle).toHaveBeenLastCalledWith(true)
    at(true, true)
    at(false, true)
    expect(mixer.muffle).toHaveBeenCalledTimes(1)
    at(false, false)
    expect(mixer.muffle).toHaveBeenLastCalledWith(false)
    expect(mixer.muffle).toHaveBeenCalledTimes(2)
  })
})

describe("SoundToggle with a mixer", () => {
  it("toggles through the mixer and shows the preference", () => {
    const { mixer } = stubMixer()
    render(<SoundToggle mixer={mixer} />)
    const button = screen.getByRole("button", { name: "Sound" })
    fireEvent.click(button)
    expect(mixer.toggle).toHaveBeenCalledTimes(1)
    expect(button.getAttribute("aria-pressed")).toBe("true")
  })

  it("plays its bed on the mixer's bed bus", () => {
    const { mixer, handle } = stubMixer()
    const { unmount } = render(<SoundToggle mixer={mixer} src="/bed.mp3" />)
    expect(mixer.load).toHaveBeenCalledWith("/bed.mp3", "/bed.mp3")
    expect(mixer.loop).toHaveBeenCalledWith("/bed.mp3", { bus: "bed" })
    unmount()
    expect(handle.stop).toHaveBeenCalled()
  })

  it("falls back to playBed when the mixer cannot load the bed", async () => {
    const instances: unknown[] = []
    vi.stubGlobal(
      "Audio",
      class {
        loop = false
        preload = ""
        volume = 0
        src = ""
        play = vi.fn(() => Promise.resolve())
        pause = vi.fn()
        constructor() {
          instances.push(this)
        }
      },
    )
    const { mixer } = stubMixer()
    mixer.load.mockImplementation(() => Promise.resolve(false))
    render(<SoundToggle mixer={mixer} src="/elsewhere.mp3" />)
    await act(async () => {})
    expect(instances).toHaveLength(1)
  })

  it("follows four bands while audible, and rests when not", async () => {
    const { mixer, setAudible } = stubMixer({ on: true, audible: false })
    const { container } = render(<SoundToggle mixer={mixer} />)
    await act(async () => {})
    expect(mixer.bands).not.toHaveBeenCalled()
    act(() => setAudible(true))
    expect(mixer.bands).toHaveBeenCalledWith(4)
    await act(() => new Promise((r) => setTimeout(r, 60)))
    const bars = [...container.querySelectorAll<HTMLElement>('[data-slot="sound-toggle-bar"]')]
    expect(bars.map((b) => b.style.transform)).toEqual(Array(4).fill("scaleY(0.625)"))
    act(() => setAudible(false))
    expect(bars[1]!.style.transform).toBe("scaleY(1)")
  })

  it("keeps the bars still under reduced motion", async () => {
    mockMedia([REDUCED])
    const { mixer } = stubMixer({ on: true })
    render(<SoundToggle mixer={mixer} />)
    await act(async () => {})
    expect(mixer.bands).not.toHaveBeenCalled()
  })

  it("keeps the plain toggle when given a preference of its own and no mixer", () => {
    const pref = createSoundPreference({ storage: null })
    render(<SoundToggle preference={pref} />)
    fireEvent.click(screen.getByRole("button", { name: "Sound" }))
    expect(pref.state).toBe("on")
  })
})
