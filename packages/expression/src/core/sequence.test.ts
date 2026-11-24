import { describe, expect, it } from "vitest"
import { fitRect, loadOrder, loadSequence, nearestLoaded, SEQUENCE_CONCURRENCY, SEQUENCE_LERP, stepToward } from "./sequence"

describe("loadOrder", () => {
  it("loads the first and last frames, then midpoints breadth-first", () => {
    expect(loadOrder(0)).toEqual([])
    expect(loadOrder(1)).toEqual([0])
    expect(loadOrder(2)).toEqual([0, 1])
    expect(loadOrder(3)).toEqual([0, 2, 1])
    expect(loadOrder(5)).toEqual([0, 4, 2, 1, 3])
    expect(loadOrder(9)).toEqual([0, 8, 4, 2, 6, 1, 3, 5, 7])
    expect(loadOrder(10)).toEqual([0, 9, 4, 2, 6, 1, 3, 5, 7, 8])
  })

  it("lists every index exactly once", () => {
    for (const n of [4, 24, 120, 142]) {
      const order = loadOrder(n)
      expect(order).toHaveLength(n)
      expect(new Set(order).size).toBe(n)
      expect(order.slice(0, 2)).toEqual([0, n - 1])
    }
  })

  it("treats a fractional or negative count as whole frames", () => {
    expect(loadOrder(-3)).toEqual([])
    expect(loadOrder(3.7)).toEqual([0, 2, 1])
  })
})

describe("nearestLoaded", () => {
  it("returns -1 when nothing has loaded", () => {
    expect(nearestLoaded(5, new Set())).toBe(-1)
  })

  it("picks the nearest loaded index, the lower one on a tie", () => {
    const loaded = new Set([0, 8, 4])
    expect(nearestLoaded(0, loaded)).toBe(0)
    expect(nearestLoaded(1.9, loaded)).toBe(0)
    expect(nearestLoaded(2, loaded)).toBe(0)
    expect(nearestLoaded(2.1, loaded)).toBe(4)
    expect(nearestLoaded(6, loaded)).toBe(4)
    expect(nearestLoaded(6.5, loaded)).toBe(8)
    expect(nearestLoaded(4, loaded)).toBe(4)
    expect(nearestLoaded(6, new Set([8, 4]))).toBe(4)
  })
})

describe("stepToward", () => {
  it("closes 8% of the gap per 60fps frame and lands exactly", () => {
    expect(SEQUENCE_LERP).toBe(0.08)
    expect(stepToward(0, 100, 1000 / 60)).toBeCloseTo(8, 6)
    expect(stepToward(0, 100, 2000 / 60)).toBeCloseTo(100 * (1 - 0.92 * 0.92), 6)
    expect(stepToward(9.995, 10, 16)).toBe(10)
    expect(stepToward(3, 3, 16)).toBe(3)
  })
})

describe("fitRect", () => {
  it("covers from the centre and contains whole", () => {
    expect(fitRect(200, 100, 100, 100, "cover")).toEqual({ x: -50, y: 0, width: 200, height: 100 })
    expect(fitRect(200, 100, 100, 100, "contain")).toEqual({ x: 0, y: 25, width: 100, height: 50 })
  })
})

describe("loadSequence", () => {
  const urls = Array.from({ length: 9 }, (_, i) => `frame-${i}.avif`)

  it("requests frames in load order, two at a time", async () => {
    const started: number[] = []
    let inFlight = 0
    let peak = 0
    const load = async (url: string) => {
      const index = urls.indexOf(url)
      started.push(index)
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return index
    }
    const arrived: number[] = []
    const run = loadSequence(urls, { load, onFrame: (i) => arrived.push(i) })
    await run.done
    expect(SEQUENCE_CONCURRENCY).toBe(2)
    expect(peak).toBe(2)
    expect(started).toEqual(loadOrder(9))
    expect([...run.loaded].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(run.frames.get(4)).toBe(4)
    expect(arrived).toHaveLength(9)
  })

  it("skips a frame that fails", async () => {
    const run = loadSequence(urls, { load: async (url) => (url === "frame-4.avif" ? Promise.reject(new Error("404")) : url) })
    await run.done
    expect(run.loaded.has(4)).toBe(false)
    expect(run.loaded.size).toBe(8)
  })

  it("stops on abort: nothing more starts, nothing late is kept", async () => {
    const controller = new AbortController()
    const started: string[] = []
    const load = (url: string, signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        started.push(url)
        const t = setTimeout(() => resolve(url), 5)
        signal.addEventListener("abort", () => {
          clearTimeout(t)
          reject(signal.reason)
        })
      })
    const run = loadSequence(urls, { load, signal: controller.signal })
    controller.abort()
    await run.done
    expect(started).toHaveLength(2)
    expect(run.loaded.size).toBe(0)
  })

  it("does nothing when already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    const run = loadSequence(urls, { load: async () => ++calls, signal: controller.signal })
    await run.done
    expect(calls).toBe(0)
  })
})
