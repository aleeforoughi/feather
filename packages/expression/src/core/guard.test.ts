import { afterEach, describe, expect, it, vi } from "vitest"
import { ENTRANCE_STALL_MS, guardEntrance } from "./visibility"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("guardEntrance: content never depends on a frame running", () => {
  it("shows the end state at once when the document is hidden", () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    const stall = vi.fn()
    guardEntrance(stall)
    expect(stall).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it("shows the end state when no frame is drawn within the wait", () => {
    vi.useFakeTimers()
    vi.stubGlobal("requestAnimationFrame", () => 1)
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const stall = vi.fn()
    guardEntrance(stall)
    vi.advanceTimersByTime(ENTRANCE_STALL_MS - 1)
    expect(stall).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stall).toHaveBeenCalledTimes(1)
  })

  it("leaves a drawing page alone, and disposes cleanly", () => {
    vi.useFakeTimers()
    let frame: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => ((frame = cb), 1))
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const stall = vi.fn()
    guardEntrance(stall)
    frame!(16)
    vi.advanceTimersByTime(ENTRANCE_STALL_MS * 2)
    expect(stall).not.toHaveBeenCalled()
    const other = vi.fn()
    const dispose = guardEntrance(other)
    dispose()
    vi.advanceTimersByTime(ENTRANCE_STALL_MS * 2)
    expect(other).not.toHaveBeenCalled()
  })
})
