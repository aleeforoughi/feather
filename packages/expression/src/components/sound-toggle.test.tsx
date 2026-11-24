import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createSoundPreference } from "../core/sound"
import { SoundToggle } from "./sound-toggle"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => {
  mockMedia([])
  vi.unstubAllGlobals()
})

describe("SoundToggle", () => {
  it("is a named toggle button, off by default, with a 48px target", () => {
    const pref = createSoundPreference({ storage: null })
    render(<SoundToggle preference={pref} />)
    const button = screen.getByRole("button", { name: "Sound" })
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(button.className).toContain("min-h-12")
    expect(button.querySelector('[data-slot="sound-toggle-bars"]')!.getAttribute("aria-hidden")).toBe("true")
  })

  it("follows the preference both ways", async () => {
    const user = userEvent.setup()
    const pref = createSoundPreference({ storage: null })
    render(<SoundToggle preference={pref} label="Sound" />)
    const button = screen.getByRole("button", { name: "Sound" })
    await user.click(button)
    expect(pref.state).toBe("on")
    expect(button.getAttribute("aria-pressed")).toBe("true")
    act(() => pref.set("off"))
    expect(button.getAttribute("aria-pressed")).toBe("false")
  })

  it("animates the bars only while audible and not reduced", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }))
    Element.prototype.animate = animate as never
    const pref = createSoundPreference({ storage: null })
    render(<SoundToggle preference={pref} />)
    expect(animate).not.toHaveBeenCalled()
    act(() => pref.set("on"))
    expect(animate).toHaveBeenCalledTimes(4)
    delete (Element.prototype as { animate?: unknown }).animate
  })

  it("keeps the bars still under reduced motion", () => {
    mockMedia([REDUCED])
    const animate = vi.fn(() => ({ cancel: vi.fn() }))
    Element.prototype.animate = animate as never
    const pref = createSoundPreference({ storage: null })
    pref.set("on")
    render(<SoundToggle preference={pref} />)
    expect(animate).not.toHaveBeenCalled()
    delete (Element.prototype as { animate?: unknown }).animate
  })

  it("plays no bed without a src, and disposes the bed on unmount", () => {
    const instances: Array<{ pause: ReturnType<typeof vi.fn> }> = []
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
    const pref = createSoundPreference({ storage: null })
    const none = render(<SoundToggle preference={pref} />)
    none.unmount()
    expect(instances).toHaveLength(0)
    const { unmount } = render(<SoundToggle src="/bed.mp3" preference={pref} />)
    expect(instances).toHaveLength(1)
    unmount()
    expect(instances[0]!.pause).toHaveBeenCalled()
  })
})
