import { describe, expect, it, vi } from "vitest"
import { createClock } from "./clock"
import { cappedPixelRatio, createWorld, DPR_CAP, pickQuality, type WorldFrame } from "./world"
import { fakeFrames } from "../test/helpers"

describe("cappedPixelRatio", () => {
  it("never exceeds the tier cap", () => {
    for (const q of ["high", "medium", "low"] as const) {
      for (const dpr of [0, 1, 1.25, 2, 3, 4]) expect(cappedPixelRatio(q, dpr)).toBeLessThanOrEqual(DPR_CAP[q])
    }
    expect(cappedPixelRatio("high", 3)).toBe(2)
    expect(cappedPixelRatio("medium", 3)).toBe(1.5)
    expect(cappedPixelRatio("low", 3)).toBe(1)
    expect(cappedPixelRatio("high", 1)).toBe(1)
  })
})

describe("pickQuality", () => {
  it.each([
    [{ reducedMotion: true }, "static"],
    [{ saveData: true }, "static"],
    [{ webgl: false }, "static"],
    [{ cores: 2 }, "low"],
    [{ memory: 2 }, "low"],
    [{ coarsePointer: true }, "medium"],
    [{ cores: 4 }, "medium"],
    [{ memory: 4 }, "medium"],
    [{ cores: 8, memory: 8, webgl: true }, "high"],
    [{}, "high"],
  ] as const)("%j is %s", (hints, expected) => {
    expect(pickQuality(hints)).toBe(expected)
  })
})

describe("createWorld", () => {
  it("renders on demand and rests when the renderer returns false", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const renderer = { frame: vi.fn(() => false), dispose: vi.fn() }
    const world = createWorld(document.createElement("canvas"), renderer, "medium", clock)
    frames.flush(1)
    expect(renderer.frame).toHaveBeenCalledTimes(1)
    expect(clock.size).toBe(0)
    world.invalidate()
    frames.flush(2)
    expect(renderer.frame).toHaveBeenCalledTimes(2)
    world.dispose()
  })

  it("keeps rendering while the renderer asks for more, and disposes", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    let n = 0
    const renderer = { frame: vi.fn(() => ++n < 3), dispose: vi.fn() }
    const world = createWorld(document.createElement("canvas"), renderer, "high", clock)
    frames.flush(1)
    frames.flush(2)
    frames.flush(3)
    frames.flush(4)
    expect(renderer.frame).toHaveBeenCalledTimes(3)
    world.dispose()
    expect(renderer.dispose).toHaveBeenCalled()
    expect(clock.size).toBe(0)
    world.invalidate()
    expect(clock.size).toBe(0)
  })

  it("passes the capped pixel ratio", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const renderer = { frame: vi.fn<(f: WorldFrame) => boolean>(() => false) }
    createWorld(document.createElement("canvas"), renderer, "low", clock)
    frames.flush(1)
    expect(renderer.frame.mock.calls[0]?.[0]?.pixelRatio).toBeLessThanOrEqual(1)
  })

  it("never renders when static", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const renderer = { frame: vi.fn(() => false), dispose: vi.fn() }
    const world = createWorld(document.createElement("canvas"), renderer, "static", clock)
    world.invalidate()
    frames.flush(1)
    expect(renderer.frame).not.toHaveBeenCalled()
    expect(clock.size).toBe(0)
    world.dispose()
    expect(renderer.dispose).toHaveBeenCalled()
  })
})
