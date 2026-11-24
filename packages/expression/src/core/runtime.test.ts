// The wave 1 runtime: frame clamp, pixel budget, quality ladder, capability gate, per-frame work, honest loading,
// sound preference and route arrival.
import { afterEach, describe, expect, it, vi } from "vitest"
import { createClock, MAX_DELTA } from "./clock"
import { perFrame } from "./frames"
import { capabilityGate, retire } from "./gate"
import { createQualityLadder } from "./ladder"
import { honestProgress, LOADER_MS } from "./loader"
import { createSoundPreference } from "./sound"
import { arrive, createTransitions } from "./transition"
import { cappedPixelRatio, MIN_PIXEL_RATIO, PIXEL_BUDGET } from "./world"
import { fakeFrames, mockMedia, REDUCED } from "../test/helpers"

const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe("clock frame clamp", () => {
  it("never hands a tick more than 1/20s, however long the stall", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const tick = vi.fn()
    clock.add(tick)
    frames.flush(0)
    frames.flush(5000)
    expect(tick).toHaveBeenLastCalledWith(5000, MAX_DELTA)
    expect(MAX_DELTA).toBe(50)
  })
})

describe("pixel budget", () => {
  it("draws no more than the budget on a large screen, and never below the floor", () => {
    const r = cappedPixelRatio("high", 2, 2560, 1440)
    expect(2560 * 1440 * r * r).toBeLessThanOrEqual(PIXEL_BUDGET + 1)
    expect(cappedPixelRatio("high", 2, 390, 844)).toBe(2)
    expect(cappedPixelRatio("medium", 3, 390, 844)).toBe(1.5)
    expect(cappedPixelRatio("high", 2, 20000, 20000)).toBe(MIN_PIXEL_RATIO)
  })
})

describe("quality ladder", () => {
  const run = (ladder: ReturnType<typeof createQualityLadder>, fps: number, ms: number) => {
    const step = 1000 / fps
    for (let t = 0; t < ms; t += step) ladder.frame(t, step)
  }
  it("steps down when a measurement falls below the floor, never past the last level", () => {
    const onChange = vi.fn()
    const onStruggle = vi.fn()
    const ladder = createQualityLadder({ levels: 3, onChange, onStruggle })
    run(ladder, 30, 1100)
    expect(ladder.level).toBe(1)
    run(ladder, 30, 3300)
    expect(ladder.level).toBe(2)
    expect(onStruggle).toHaveBeenCalled()
    expect(onChange).toHaveBeenLastCalledWith(2)
  })
  it("tries one step up after holding comfortably, and waits longer after a failed try", () => {
    const ladder = createQualityLadder({ levels: 3, start: 1, recheck: 2000, onChange: () => {} })
    run(ladder, 60, 2100)
    expect(ladder.level).toBe(0)
    run(ladder, 30, 1100)
    expect(ladder.level).toBe(1)
    run(ladder, 60, 2100)
    expect(ladder.level).toBe(1)
    run(ladder, 60, 2100)
    expect(ladder.level).toBe(0)
  })
  it("does not measure while the tab is hidden", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    const ladder = createQualityLadder({ levels: 3, onChange: () => {} })
    run(ladder, 10, 3000)
    expect(ladder.level).toBe(0)
    hidden.mockRestore()
  })
})

describe("capability gate", () => {
  const strong = { reducedMotion: false, saveData: false, webgl: true, cores: 8, memory: 8, coarsePointer: false }
  it("runs the heavy tier only on capable devices, and names every reason it does not", () => {
    expect(capabilityGate({ hints: strong, storage: null })).toEqual({ full: true, reasons: [] })
    expect(capabilityGate({ hints: { ...strong, cores: 4, memory: 4 }, storage: null }).reasons).toEqual(["cores", "memory"])
    expect(capabilityGate({ hints: { ...strong, coarsePointer: true }, storage: null }).full).toBe(false)
    expect(capabilityGate({ hints: { ...strong, coarsePointer: true }, allowTouch: true, storage: null }).full).toBe(true)
    expect(capabilityGate({ hints: { ...strong, reducedMotion: true, saveData: true, webgl: false }, storage: null }).reasons).toEqual(["reduced-motion", "save-data", "no-webgl"])
    expect(capabilityGate({ hints: {}, storage: null }).full).toBe(true)
  })
  it("remembers a retired effect for 30 days, per effect", () => {
    const storage = memoryStorage()
    retire({ key: "globe", storage, now: 0 })
    expect(capabilityGate({ key: "globe", hints: strong, storage, now: 29 * 86_400_000 }).reasons).toEqual(["retired"])
    expect(capabilityGate({ key: "other", hints: strong, storage, now: 0 }).full).toBe(true)
    expect(capabilityGate({ key: "globe", hints: strong, storage, now: 31 * 86_400_000 }).full).toBe(true)
  })
})

describe("perFrame", () => {
  it("runs one task per frame, reports progress, and survives a task that throws", async () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const order: number[] = []
    const progress: number[] = []
    const run = perFrame([() => order.push(1), () => { throw new Error("x") }, () => order.push(3)], { clock, onProgress: (p) => progress.push(p) })
    for (let t = 0; t < 10 && order.length < 2; t++) {
      frames.flush(t * 16)
      await Promise.resolve()
      await Promise.resolve()
    }
    await run.done
    expect(order).toEqual([1, 3])
    expect(progress.at(-1)).toBe(1)
  })
  it("settles when cancelled", async () => {
    const run = perFrame([() => {}], { clock: createClock(fakeFrames()) })
    run.cancel()
    await expect(run.done).resolves.toBeUndefined()
  })
})

describe("honest progress", () => {
  it("shows the lesser of what is ready and the minimum time, and finishes at 1", async () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    let resolve!: () => void
    const task = new Promise<void>((r) => (resolve = r))
    const seen: number[] = []
    const onDone = vi.fn()
    honestProgress({ tasks: [task], clock, storage: null, onProgress: (p) => seen.push(p), onDone })
    for (let t = 0; t <= 3000; t += 50) frames.flush(t)
    expect(Math.max(...seen)).toBe(0)
    resolve()
    await task
    for (let t = 3050; t <= 3200; t += 50) frames.flush(t)
    expect(seen.at(-1)).toBe(1)
    expect(onDone).toHaveBeenCalledOnce()
  })
  it("uses the shorter minimum on a return visit, and the cap ends any wait", () => {
    const storage = memoryStorage()
    storage.setItem("feather-visited", "1")
    const frames = fakeFrames()
    const clock = createClock(frames)
    const onDone = vi.fn()
    const p = honestProgress({ clock, storage, onProgress: () => {}, onDone })
    expect(p.returning).toBe(true)
    for (let t = 0; t <= LOADER_MS.returning + 50; t += 50) frames.flush(t)
    expect(onDone).toHaveBeenCalledOnce()
    const never = new Promise<void>(() => {})
    const capped = vi.fn()
    honestProgress({ tasks: [never], clock, storage: null, onProgress: () => {}, onDone: capped })
    for (let t = 10000; t <= 10000 + LOADER_MS.cap + 100; t += 50) frames.flush(t)
    expect(capped).toHaveBeenCalledOnce()
  })
})

describe("sound preference", () => {
  it("is off by default, remembers the choice, and is silent while hidden", () => {
    const storage = memoryStorage()
    const pref = createSoundPreference({ storage })
    expect(pref.state).toBe("off")
    expect(pref.audible).toBe(false)
    const listener = vi.fn()
    pref.subscribe(listener)
    pref.toggle()
    expect(listener).toHaveBeenLastCalledWith(true, "on")
    expect(createSoundPreference({ storage }).state).toBe("on")
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true)
    expect(pref.audible).toBe(false)
    document.dispatchEvent(new Event("visibilitychange"))
    expect(listener).toHaveBeenLastCalledWith(false, "on")
    hidden.mockRestore()
  })
})

describe("route arrival", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })
  it("focuses the new h1 and announces it", () => {
    document.body.innerHTML = "<main><h1>Work</h1></main>"
    arrive(document)
    const h1 = document.querySelector("h1")!
    expect(document.activeElement).toBe(h1)
    expect(h1.getAttribute("tabindex")).toBe("-1")
    expect(document.querySelector('[data-slot="route-announcer"]')?.textContent).toBe("Work")
  })
  it("swaps at once under reduced motion, whatever the variant", async () => {
    mockMedia([REDUCED])
    const start = vi.fn()
    const update = vi.fn(() => void (document.body.innerHTML = "<h1>Next</h1>"))
    await createTransitions({ ...document, startViewTransition: start, querySelector: document.querySelector.bind(document), documentElement: document.documentElement } as never).go(update, { variant: "columns" })
    expect(update).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(document.querySelector('[data-slot="route-curtain"]')).toBeNull()
  })
  it("covers with the column curtain, swaps under it, then lifts it", async () => {
    mockMedia([])
    let coveredAtSwap = false
    await createTransitions(document as never).go(
      () => {
        coveredAtSwap = !!document.querySelector('[data-slot="route-curtain"]')
        document.body.insertAdjacentHTML("beforeend", "<h1>Next</h1>")
      },
      { variant: "columns" }
    )
    expect(coveredAtSwap).toBe(true)
    expect(document.querySelector('[data-slot="route-curtain"]')).toBeNull()
    expect(document.activeElement?.textContent).toBe("Next")
  })
})
