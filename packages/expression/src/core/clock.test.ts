import { describe, expect, it, vi } from "vitest"
import { createClock } from "./clock"
import { fakeFrames } from "../test/helpers"

describe("clock", () => {
  it("does nothing until the first subscriber, then runs one loop", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    expect(frames.pending).toBe(0)
    expect(clock.running).toBe(false)
    const a = vi.fn()
    const b = vi.fn()
    clock.add(a)
    clock.add(b)
    expect(frames.pending).toBe(1)
    frames.flush(100)
    expect(a).toHaveBeenCalledWith(100, 0)
    expect(b).toHaveBeenCalledTimes(1)
    frames.flush(116)
    expect(a).toHaveBeenLastCalledWith(116, 16)
    expect(frames.pending).toBe(1)
  })

  it("stops when the last subscriber leaves", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const off = clock.add(() => {})
    expect(clock.size).toBe(1)
    off()
    expect(clock.size).toBe(0)
    expect(clock.running).toBe(false)
    expect(frames.pending).toBe(0)
  })

  it("runs `once` on the next frame only and then rests", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const tick = vi.fn()
    clock.once(tick)
    frames.flush(10)
    expect(tick).toHaveBeenCalledTimes(1)
    expect(clock.size).toBe(0)
    expect(frames.pending).toBe(0)
  })

  it("cancels a `once` before it runs", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const tick = vi.fn()
    clock.once(tick)()
    frames.flush(10)
    expect(tick).not.toHaveBeenCalled()
  })

  it("rides on an external ticker with no own loop", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const callbacks = new Set<(t: number, d: number, f: number) => void>()
    const ticker = { add: (cb: (t: number, d: number, f: number) => void) => callbacks.add(cb), remove: (cb: (t: number, d: number, f: number) => void) => callbacks.delete(cb) }
    const tick = vi.fn()
    clock.add(tick)
    expect(frames.pending).toBe(1)
    clock.drive(ticker)
    expect(frames.pending).toBe(0)
    expect(callbacks.size).toBe(1)
    for (const cb of callbacks) cb(2, 0.016, 1)
    expect(tick).toHaveBeenCalledWith(2000, 0)
    expect(frames.pending).toBe(0)
    clock.drive(null)
    expect(callbacks.size).toBe(0)
    expect(frames.pending).toBe(1)
  })

  it("keeps exactly one frame pending when a tick schedules the next frame from inside a frame (render on demand)", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const deltas: number[] = []
    const again = (t: number, d: number) => {
      deltas.push(d)
      if (deltas.length < 6) clock.once(again)
    }
    clock.once(again)
    for (let t = 0; t <= 80; t += 16) {
      expect(frames.pending).toBeLessThanOrEqual(1)
      frames.flush(t)
    }
    expect(deltas).toEqual([0, 16, 16, 16, 16, 16])
    expect(frames.pending).toBe(0)
    expect(clock.running).toBe(false)
  })
})
