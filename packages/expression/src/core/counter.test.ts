import { afterEach, describe, expect, it, vi } from "vitest"
import { createClock } from "./clock"
import { COUNTER_MS, countTo, formatCount } from "./counter"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

describe("countTo", () => {
  it("tweens on the clock, lands exactly on the value and stops", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const values: number[] = []
    const done = vi.fn()
    countTo({ to: 100, duration: 900, onUpdate: (v) => values.push(v), onDone: done, clock })
    frames.flush(0)
    frames.flush(450)
    frames.flush(900)
    expect(values.at(-1)).toBe(100)
    expect(values.some((v) => v > 0 && v < 100)).toBe(true)
    expect(values.every((v, i) => i === 0 || v >= values[i - 1]!)).toBe(true)
    expect(done).toHaveBeenCalledTimes(1)
    expect(clock.size).toBe(0)
  })

  it("clamps the duration to 600 to 1200ms", () => {
    expect(COUNTER_MS).toEqual({ min: 600, max: 1200 })
    for (const [duration, end] of [[100, 600], [5000, 1200]] as const) {
      const frames = fakeFrames()
      const clock = createClock(frames)
      const done = vi.fn()
      countTo({ to: 10, duration, onUpdate() {}, onDone: done, clock })
      frames.flush(0)
      frames.flush(end - 1)
      expect(done).not.toHaveBeenCalled()
      frames.flush(end)
      expect(done).toHaveBeenCalled()
    }
  })

  it("shows the final value at once under reduced motion", () => {
    mockMedia([REDUCED])
    const clock = createClock(fakeFrames())
    const onUpdate = vi.fn()
    countTo({ to: 42, onUpdate, clock })
    expect(onUpdate).toHaveBeenCalledWith(42)
    expect(clock.size).toBe(0)
  })

  it("cancels", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    countTo({ to: 5, onUpdate() {}, clock })()
    expect(clock.size).toBe(0)
  })
})

describe("formatCount", () => {
  it("uses the target's decimals", () => {
    expect(formatCount(3.14159, 99.9, "en-US")).toBe("3.1")
    expect(formatCount(1234.5, 5000, "en-US")).toBe("1,235")
    expect(formatCount(0, 12.25, "en-US")).toBe("0.00")
  })
  it("reuses one formatter per locale and decimals, and keeps them apart", () => {
    expect(formatCount(1234.5, 5000, "de-DE")).toBe("1.235")
    expect(formatCount(1234.5, 5000, "en-US")).toBe("1,235")
    expect(formatCount(1234.5, 5000.5, "en-US")).toBe("1,234.5")
    expect(formatCount(1234.5, 5000, "de-DE")).toBe("1.235")
  })
})
