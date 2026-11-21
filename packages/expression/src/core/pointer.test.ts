import { afterEach, describe, expect, it } from "vitest"
import { createClock } from "./clock"
import { follow, magnetic, MAGNETIC_STRENGTH, pointerEffectsAllowed } from "./pointer"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })

describe("pointer effects", () => {
  it("need a fine pointer and motion", () => {
    mockMedia(["pointer: fine"])
    expect(pointerEffectsAllowed()).toBe(true)
    mockMedia(["pointer: fine", REDUCED])
    expect(pointerEffectsAllowed()).toBe(false)
    mockMedia([])
    expect(pointerEffectsAllowed()).toBe(false)
    expect(MAGNETIC_STRENGTH).toBe(0.15)
  })

  it("magnetic pulls toward the pointer, returns on leave and stops the clock at rest", () => {
    mockMedia(["pointer: fine"])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const el = document.createElement("button")
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    const off = magnetic(el, { on: clock })
    el.dispatchEvent(pointer("pointermove", 100, 100))
    expect(clock.size).toBe(1)
    for (let t = 0; t < 60 && clock.size; t++) frames.flush(t * 16)
    expect(el.style.translate).toBe("7.50px 7.50px")
    el.dispatchEvent(pointer("pointerleave", 0, 0))
    for (let t = 60; t < 140 && clock.size; t++) frames.flush(t * 16)
    expect(el.style.translate).toBe("")
    expect(clock.size).toBe(0)
    off()
  })

  it("does nothing for a coarse pointer or reduced motion", () => {
    mockMedia([REDUCED, "pointer: fine"])
    const clock = createClock(fakeFrames())
    const el = document.createElement("button")
    magnetic(el, { on: clock })
    el.dispatchEvent(pointer("pointermove", 10, 10))
    expect(clock.size).toBe(0)
  })

  it("follow trails the pointer and cleans up", () => {
    mockMedia(["pointer: fine"])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const el = document.createElement("div")
    const off = follow(el, { on: clock })
    window.dispatchEvent(pointer("pointermove", 200, 100))
    expect(el.dataset.state).toBe("active")
    frames.flush(0)
    expect(el.style.translate).toBe("200.0px 100.0px")
    off()
    expect(clock.size).toBe(0)
  })
})
