import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sound } from "../core/sound"
import { Loader, stopAndGo } from "./loader"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

let frames: ReturnType<typeof fakeFrames>
let time = 0
const FAST = { first: 1, returning: 1 }

beforeEach(() => {
  frames = fakeFrames()
  time = 0
  vi.stubGlobal("requestAnimationFrame", frames.request)
  vi.stubGlobal("cancelAnimationFrame", frames.cancel)
  window.requestAnimationFrame = frames.request as never
  window.cancelAnimationFrame = frames.cancel as never
  sessionStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  mockMedia([])
  sound.set("off")
})

const run = async (count = 120) => {
  for (let i = 0; i < count; i++) {
    time += 16
    await act(async () => {
      frames.flush(time)
    })
  }
}

describe("Loader", () => {
  it("renders nothing and calls onDone under reduced motion", () => {
    mockMedia([REDUCED])
    const onDone = vi.fn()
    const { container } = render(<Loader label="Loading Studio of One" onDone={onDone} />)
    expect(container.querySelector('[data-slot="loader"]')).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("is a named status in the first render, with the no-script and reduced classes", () => {
    const { container } = render(<Loader label="Loading Studio of One" minimum={FAST} />)
    const root = screen.getByRole("status", { name: "Loading Studio of One" })
    expect(root.getAttribute("data-variant")).toBe("counter")
    expect(root.getAttribute("data-state")).toBe("loading")
    expect(root.className).toContain("noscript:hidden")
    expect(root.className).toContain("motion-reduce:hidden")
    expect(container.querySelector('[data-slot="loader-number"]')!.getAttribute("aria-hidden")).toBe("true")
    expect(container.querySelector('[data-slot="loader-status"]')!.textContent).toBe("Loading")
  })

  it("locks the page while it shows and restores it after", async () => {
    document.body.insertAdjacentHTML("beforeend", '<main id="page">page</main>')
    const onDone = vi.fn()
    render(<Loader label="Loading" minimum={FAST} onDone={onDone} />)
    const page = document.getElementById("page")!
    expect(page.hasAttribute("inert")).toBe(true)
    expect(document.documentElement.style.overflow).toBe("hidden")
    await run()
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("status")).toBeNull()
    expect(page.hasAttribute("inert")).toBe(false)
    expect(document.documentElement.style.overflow).toBe("")
    page.remove()
  })

  it("restores the page when it unmounts early", () => {
    document.body.insertAdjacentHTML("beforeend", '<main id="page">page</main>')
    const { unmount } = render(<Loader label="Loading" />)
    unmount()
    expect(document.getElementById("page")!.hasAttribute("inert")).toBe(false)
    expect(document.documentElement.style.overflow).toBe("")
    document.getElementById("page")!.remove()
  })

  it("waits for a slow task, and the number never goes backwards", async () => {
    let release!: () => void
    const task = new Promise<void>((r) => (release = r))
    const { container } = render(<Loader label="Loading" minimum={FAST} tasks={[task]} />)
    const shown = () => Number(container.querySelector('[data-slot="loader-number"] span')!.textContent)
    await run(10)
    expect(screen.getByRole("status")).toBeTruthy()
    const before = shown()
    await run(10)
    expect(shown()).toBeGreaterThanOrEqual(before)
    await act(async () => release())
    await run()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("asks about sound at the end: Sound off first and focused, and the choice sets the preference", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<Loader label="Loading" sound minimum={FAST} onDone={onDone} />)
    await run()
    const off = screen.getByRole("button", { name: "Sound off" })
    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toBe(off)
    expect(document.activeElement).toBe(off)
    expect(screen.getByRole("status").getAttribute("data-state")).toBe("asking")
    expect(onDone).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Sound on" }))
    expect(sound.state).toBe("on")
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("Sound off keeps it off", async () => {
    const user = userEvent.setup()
    render(<Loader label="Loading" sound minimum={FAST} soundOffLabel="Mute" soundOnLabel="Hear it" />)
    await run()
    await user.click(screen.getByRole("button", { name: "Mute" }))
    expect(sound.state).toBe("off")
  })

  it("the dock variant has a bar and no number", () => {
    const { container } = render(<Loader label="Loading" variant="dock" />)
    expect(container.querySelector('[data-slot="loader-bar"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="loader-number"]')).toBeNull()
  })

  it("leaves with a clip-path wipe via WAAPI", async () => {
    const animate = vi.fn(() => ({}) as Animation)
    Element.prototype.animate = animate as never
    render(<Loader label="Loading" minimum={FAST} />)
    await run()
    const keyframes = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions]
    expect(keyframes[0]).toEqual([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }])
    expect(keyframes[1].duration).toBeLessThanOrEqual(1200)
    delete (Element.prototype as { animate?: unknown }).animate
  })
})

describe("stopAndGo", () => {
  it("is monotone, fixed at the ends, with plateaus", () => {
    expect(stopAndGo(0)).toBe(0)
    expect(stopAndGo(1)).toBe(1)
    let last = 0
    for (let p = 0; p <= 1; p += 0.01) {
      expect(stopAndGo(p)).toBeGreaterThanOrEqual(last - 1e-9)
      last = stopAndGo(p)
    }
    expect(stopAndGo(0.33) - stopAndGo(0.32)).toBeLessThan(0.002)
  })
})
