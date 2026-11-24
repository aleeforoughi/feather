import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clock } from "../core/clock"
import { Counter } from "./counter"
import { mockMedia, REDUCED } from "../test/helpers"

let observers: Array<{ cb: IntersectionObserverCallback; disconnect: () => void }> = []
const NBSP = " "

beforeEach(() => {
  observers = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn()
      cb: IntersectionObserverCallback
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb
        observers.push(this)
      }
      observe() {}
      unobserve() {}
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  mockMedia([])
})

const enter = () => act(() => observers.at(-1)!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))

describe("Counter", () => {
  it("keeps the final value for assistive technology and hides the tween", () => {
    const { container } = render(<Counter value={1280} unit="ms" locale="en-US" />)
    expect(container.querySelector('[data-slot="counter-value"]')!.getAttribute("aria-hidden")).toBe("true")
    expect(container.querySelector('[data-slot="counter-final"]')!.textContent).toBe(`1,280${NBSP}ms`)
    expect(container.querySelector('[data-slot="counter"]')!.className).toContain("numeric")
  })

  it("starts at the from value, waits for the viewport, then counts to the final value", () => {
    const rafs: Array<(t: number) => void> = []
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => rafs.push(cb))
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const { container } = render(<Counter value={100} locale="en-US" />)
    const value = () => container.querySelector('[data-slot="counter-value"]')!.textContent
    const root = container.querySelector('[data-slot="counter"]')!
    expect(value()).toBe("0")
    expect(root.getAttribute("data-state")).toBe("idle")
    expect(clock.size).toBe(0)
    enter()
    expect(root.getAttribute("data-state")).toBe("counting")
    expect(clock.size).toBe(1)
    act(() => rafs.shift()?.(0))
    act(() => rafs.shift()?.(2000))
    expect(value()).toBe("100")
    expect(root.getAttribute("data-state")).toBe("done")
    expect(clock.size).toBe(0)
  })

  it("shows the final value at once under reduced motion", () => {
    mockMedia([REDUCED])
    const { container } = render(<Counter value={100} unit="%" locale="en-US" />)
    expect(container.querySelector('[data-slot="counter-value"]')!.textContent).toBe(`100${NBSP}%`)
    expect(observers).toHaveLength(0)
  })

  it("leaves no subscriber behind on unmount", () => {
    const { unmount } = render(<Counter value={100} />)
    enter()
    unmount()
    expect(clock.size).toBe(0)
  })
})
