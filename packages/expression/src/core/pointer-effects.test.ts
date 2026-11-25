import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createClock } from "./clock"
import { cursorFor } from "./pointer-cursor"
import { FIELD_RADIUS, FIELD_STEPS, fieldFalloff, fieldOffset, pointerField } from "./pointer-field"
import { pointerTilt, TILT_MAX, tiltAngles } from "./pointer-tilt"
import { pointerTrail, trailPoolSize } from "./pointer-trail"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

beforeEach(() => document.documentElement.style.setProperty("--loudness", "3"))
afterEach(() => {
  mockMedia([])
  document.documentElement.style.removeProperty("--loudness")
  document.body.innerHTML = ""
})

const pointer = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), extra)
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

describe("tilt maths", () => {
  const box = { left: 0, top: 0, width: 200, height: 100 }
  it("leans toward the pointer and is zero at the centre", () => {
    expect(tiltAngles(100, 50, box)).toEqual({ x: -0, y: 0 })
    const right = tiltAngles(200, 50, box)
    expect(right.y).toBe(TILT_MAX)
    const top = tiltAngles(100, 0, box)
    expect(top.x).toBe(TILT_MAX)
  })
  it("clamps max to 12 and the pointer to the box", () => {
    expect(tiltAngles(9999, 50, box, 40).y).toBe(12)
    expect(tiltAngles(200, 50, box, -3).y).toBe(0)
    expect(tiltAngles(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe("field maths", () => {
  it("falls off as 1 - (d/r)^2", () => {
    expect(fieldFalloff(0)).toBe(1)
    expect(fieldFalloff(150)).toBeCloseTo(0.75, 5)
    expect(fieldFalloff(FIELD_RADIUS)).toBe(0)
    expect(fieldFalloff(500)).toBe(0)
  })
  it("pushes directly away, at most FIELD_STEPS times the strength", () => {
    const o = fieldOffset({ x: 100, y: 0 }, { x: 0, y: 0 }, 300, 1)
    expect(o.y).toBeCloseTo(0, 5)
    expect(o.x).toBeCloseTo(fieldFalloff(100) * FIELD_STEPS, 5)
    expect(fieldOffset({ x: 400, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(Math.hypot(fieldOffset({ x: 1, y: 1 }, { x: 0, y: 0 }, 300, 5).x, fieldOffset({ x: 1, y: 1 }, { x: 0, y: 0 }, 300, 5).y)).toBeLessThanOrEqual(FIELD_STEPS)
  })
})

describe("trail pool", () => {
  it("is 8 to 12 whatever the image count", () => {
    expect([1, 8, 10, 12, 40].map(trailPoolSize)).toEqual([8, 8, 10, 12, 12])
  })
})

describe("cursorFor", () => {
  it("reads the nearest opt-in, with the default or custom label, and skips fields", () => {
    document.body.innerHTML = '<a data-cursor="drag"><b id="a"></b></a><a data-cursor="link" data-cursor-label="Go" id="b"></a><a data-cursor="nope" id="c"></a><div data-cursor="view"><textarea id="d"></textarea></div><div contenteditable="true" data-cursor="view" id="e"></div>'
    expect(cursorFor(document.getElementById("a"))).toEqual({ kind: "drag", label: "Drag" })
    expect(cursorFor(document.getElementById("b"))).toEqual({ kind: "link", label: "Go" })
    expect(cursorFor(document.getElementById("c"))).toBeNull()
    expect(cursorFor(document.getElementById("d"))).toBeNull()
    expect(cursorFor(document.getElementById("e"))).toBeNull()
    expect(cursorFor(null)).toBeNull()
  })
})

describe("pointerTilt", () => {
  it("tilts, springs back to nothing and frees the clock", () => {
    mockMedia(["pointer: fine"])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const el = document.createElement("div")
    document.body.append(el)
    el.getBoundingClientRect = () => rect(0, 0, 200, 100)
    const off = pointerTilt(el, { on: clock })
    el.dispatchEvent(pointer("pointermove", 200, 50))
    expect(clock.size).toBe(1)
    frames.flush(0)
    frames.flush(16)
    expect(parseFloat(el.style.getPropertyValue("--tilt-y"))).toBeGreaterThan(0)
    expect(parseFloat(el.style.getPropertyValue("--tilt-y"))).toBeLessThanOrEqual(TILT_MAX)
    el.dispatchEvent(pointer("pointerleave", 0, 0))
    for (let t = 0; t < 200 && clock.size; t++) frames.flush(32 + t * 16)
    expect(clock.size).toBe(0)
    expect(el.style.getPropertyValue("--tilt-y")).toBe("")
    off()
  })
  it("lifts on keyboard focus", () => {
    mockMedia(["pointer: fine"])
    const el = document.createElement("div")
    const button = document.createElement("button")
    el.append(button)
    document.body.append(el)
    const off = pointerTilt(el)
    button.focus()
    expect(el.dataset.lift).toBe("true")
    button.blur()
    expect(el.dataset.lift).toBeUndefined()
    off()
  })
  it("is off for touch, reduced motion and quiet pages", () => {
    const el = document.createElement("div")
    el.getBoundingClientRect = () => rect(0, 0, 100, 100)
    document.body.append(el)
    const clock = createClock(fakeFrames())
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "1"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const off = pointerTilt(el, { on: clock })
      el.dispatchEvent(pointer("pointermove", 100, 50))
      expect(clock.size).toBe(0)
      off()
    }
    mockMedia(["pointer: fine"])
    document.documentElement.style.setProperty("--loudness", "3")
    const off = pointerTilt(el, { on: clock })
    el.dispatchEvent(pointer("pointermove", 100, 50, { pointerType: "touch" }))
    expect(clock.size).toBe(0)
    off()
  })
})

describe("pointerField", () => {
  const setup = () => {
    const root = document.createElement("div")
    const near = document.createElement("span")
    const far = document.createElement("span")
    near.dataset.pointerItem = ""
    far.dataset.pointerItem = ""
    near.getBoundingClientRect = () => rect(100, 0, 20, 20)
    far.getBoundingClientRect = () => rect(900, 0, 20, 20)
    root.append(near, far)
    document.body.append(root)
    return { root, near, far }
  }
  it("pushes the near item away, leaves the far one, and returns on leave", () => {
    mockMedia(["pointer: fine"])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const { root, near, far } = setup()
    const off = pointerField(root, { on: clock, strength: 1 })
    root.dispatchEvent(pointer("pointermove", 50, 10))
    for (let t = 0; t < 40; t++) frames.flush(t * 16)
    expect(parseFloat(near.style.getPropertyValue("--field-x"))).toBeGreaterThan(1)
    expect(parseFloat(far.style.getPropertyValue("--field-x"))).toBe(0)
    root.dispatchEvent(pointer("pointerleave", 0, 0))
    for (let t = 0; t < 400 && clock.size; t++) frames.flush(1000 + t * 16)
    expect(clock.size).toBe(0)
    expect(parseFloat(near.style.getPropertyValue("--field-x"))).toBeCloseTo(0, 1)
    off()
    expect(near.style.translate).toBe("")
  })
  it("does nothing on touch, under reduced motion or when quiet, and pauses while hidden", () => {
    const clock = createClock(fakeFrames())
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "1"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const { root } = setup()
      const off = pointerField(root, { on: clock })
      root.dispatchEvent(pointer("pointermove", 50, 10))
      expect(clock.size).toBe(0)
      off()
    }
    mockMedia(["pointer: fine"])
    document.documentElement.style.setProperty("--loudness", "3")
    const { root } = setup()
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    const off = pointerField(root, { on: clock })
    root.dispatchEvent(pointer("pointermove", 50, 10))
    expect(clock.size).toBe(0)
    Object.defineProperty(document, "hidden", { configurable: true, value: false })
    off()
  })
})

describe("pointerTrail", () => {
  const setup = (n = 10) => {
    const root = document.createElement("div")
    root.getBoundingClientRect = () => rect(0, 0, 1000, 600)
    const pool = Array.from({ length: n }, () => document.createElement("img"))
    root.append(...pool)
    document.body.append(root)
    return { root, pool }
  }
  it("spawns past the spacing threshold, reuses a capped pool, and ends at rest", () => {
    mockMedia(["pointer: fine"])
    const frames = fakeFrames()
    const clock = createClock(frames)
    const { root, pool } = setup(10)
    const off = pointerTrail(root, pool, { images: ["a.jpg", "b.jpg"], spacing: 100, lifetime: 500, on: clock })
    root.dispatchEvent(pointer("pointermove", 10, 10))
    root.dispatchEvent(pointer("pointermove", 50, 10))
    expect(pool.filter((p) => p.src).length).toBe(1)
    for (let x = 200; x < 5000; x += 150) root.dispatchEvent(pointer("pointermove", x % 1000, 10))
    const used = pool.filter((p) => p.getAttribute("src"))
    expect(used.length).toBeLessThanOrEqual(10)
    expect(new Set(used.map((p) => p.getAttribute("src")))).toEqual(new Set(["a.jpg", "b.jpg"]))
    for (let t = 0; t < 100 && clock.size; t++) frames.flush(t * 20)
    expect(clock.size).toBe(0)
    expect(pool.every((p) => p.style.opacity === "0")).toBe(true)
    off()
  })
  it("is off for touch, reduced motion and loudness below 3", () => {
    const clock = createClock(fakeFrames())
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "2"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const { root, pool } = setup()
      const off = pointerTrail(root, pool, { images: ["a.jpg"], on: clock })
      root.dispatchEvent(pointer("pointermove", 10, 10))
      root.dispatchEvent(pointer("pointermove", 400, 10))
      expect(clock.size).toBe(0)
      expect(pool.some((p) => p.getAttribute("src"))).toBe(false)
      off()
    }
    mockMedia(["pointer: fine"])
    document.documentElement.style.setProperty("--loudness", "3")
    const { root, pool } = setup()
    const off = pointerTrail(root, pool, { images: ["a.jpg"], on: clock })
    root.dispatchEvent(pointer("pointermove", 10, 10, { pointerType: "touch" }))
    expect(clock.size).toBe(0)
    off()
  })
})
