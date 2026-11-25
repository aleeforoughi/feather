import { describe, expect, it } from "vitest"
import { createClock } from "./clock"
import {
  BLINK_MS,
  BLINK_TIMES,
  OVAL_CAP,
  PRESETS,
  SKEW_MIN_WIDTH,
  blinkFrames,
  createScramble,
  effectDelays,
  effectFrames,
  effectUnit,
  isStatic,
  resolveEffect,
  scrambleDuration,
  scrambleFrame,
  settleAt,
  skewAllowed,
  swapInterval,
  swapNext,
  swapParts,
} from "./text"
import { fakeFrames } from "../test/helpers"

const seeded = () => {
  let n = 0.1
  return () => ((n = (n * 9301 + 0.49297) % 1), n)
}

describe("effect presets", () => {
  it("every sequence ends within its cap, however many pieces", () => {
    for (const effect of ["mask", "skew", "oval"] as const)
      for (const unit of ["line", "word", "char"] as const)
        for (const count of [1, 3, 12, 200]) {
          const delays = effectDelays(effect, unit, count)
          expect(delays.at(-1)! + PRESETS[effect].duration).toBeLessThanOrEqual(PRESETS[effect].cap)
        }
  })
  it("mask and skew end within 1.2s; oval is the one long reveal, within 1.8s", () => {
    expect(PRESETS.mask.cap).toBe(1200)
    expect(PRESETS.skew.cap).toBe(1200)
    expect(PRESETS.oval.cap).toBe(OVAL_CAP)
    expect(PRESETS.oval.duration).toBe(1500)
  })
  it("the stagger is the measured one: 0.1 a line, 0.02 a character, 0.15 an oval line", () => {
    expect(effectDelays("mask", "line", 3)).toEqual([0, 100, 200])
    expect(effectDelays("mask", "char", 3)).toEqual([0, 20, 40])
    expect(effectDelays("oval", "line", 3)).toEqual([0, 150, 300])
  })
  it("skew falls back to mask below 992px or under reduced motion", () => {
    expect(skewAllowed(false, SKEW_MIN_WIDTH)).toBe(true)
    expect(skewAllowed(false, SKEW_MIN_WIDTH - 1)).toBe(false)
    expect(skewAllowed(true, 1600)).toBe(false)
    expect(resolveEffect("skew", false)).toBe("mask")
    expect(resolveEffect("skew", true)).toBe("skew")
    expect(resolveEffect("oval", false)).toBe("oval")
  })
  it("picks the unit: the effect's own, the caller's split, oval always by line", () => {
    expect(effectUnit("mask")).toBe("line")
    expect(effectUnit("skew")).toBe("char")
    expect(effectUnit("mask", "word")).toBe("word")
    expect(effectUnit("mask", "none")).toBe("line")
    expect(effectUnit("oval", "char")).toBe("line")
  })
  it("frames: mask rises from 110%, oval opens an ellipse, skew keeps visible titles opaque", () => {
    expect(effectFrames("mask", false)[0].transform).toBe("translateY(110%)")
    expect(effectFrames("oval", false).map((f) => f.clipPath)).toEqual(["ellipse(20% 0% at 50% 0%)", "ellipse(100% 120% at 50% 0%)"])
    expect(effectFrames("skew", false)[0].opacity).toBe(0)
    expect(effectFrames("skew", true)[0].opacity).toBeUndefined()
    expect(effectFrames("skew", false)[0].transform).toContain("skewX(14deg)")
  })
})

describe("blink", () => {
  it("is 0, 1, 0, 1 at 0, 90, 150 and 210 ms", () => {
    expect(BLINK_TIMES).toEqual([0, 90, 150, 210])
    const frames = blinkFrames()
    expect(frames.map((f) => f.opacity)).toEqual([0, 1, 0, 1])
    expect(frames.map((f) => Math.round((f.offset as number) * BLINK_MS))).toEqual([0, 90, 150, 210])
  })
})

describe("scramble", () => {
  it("runs 600 to 900 ms", () => {
    expect(scrambleDuration(3)).toBe(600)
    expect(scrambleDuration(500)).toBe(900)
  })
  it("settles left to right and ends on the exact text", () => {
    const chars = [..."Hello, world"]
    const rand = seeded()
    expect(scrambleFrame(chars, 1, rand)).toEqual(chars)
    const half = scrambleFrame(chars, settleAt(2, chars.length), rand)
    expect(half.slice(0, 3)).toEqual(chars.slice(0, 3))
    expect(half.slice(0, 3).join("")).toBe("Hel")
  })
  it("keeps spaces and punctuation, and keeps the kind of each character", () => {
    const chars = [..."Ab1, z"]
    const frame = scrambleFrame(chars, 0, seeded())
    expect(frame[3]).toBe(",")
    expect(frame[4]).toBe(" ")
    expect(frame[0]).toMatch(/[A-Z]/)
    expect(frame[1]).toMatch(/[a-z]/)
    expect(frame[2]).toMatch(/\d/)
    expect(isStatic("—")).toBe(true)
  })
  it("runs on the clock and finishes on the exact text, calling onDone once", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    const seen: string[] = []
    let done = 0
    createScramble("Make it liquid", { clock, rand: seeded(), onFrame: (c) => seen.push(c.join("")), onDone: () => done++ })
    expect(seen[0]).not.toBe("Make it liquid")
    let t = 0
    for (let i = 0; i < 80 && done === 0; i++) frames.flush((t += 16))
    expect(done).toBe(1)
    expect(seen.at(-1)).toBe("Make it liquid")
    expect(clock.size).toBe(0)
  })
  it("cancel shows the final text and stops the clock", () => {
    const frames = fakeFrames()
    const clock = createClock(frames)
    let last = ""
    const cancel = createScramble("Stay", { clock, onFrame: (c) => (last = c.join("")) })
    expect(clock.size).toBe(1)
    cancel()
    expect(last).toBe("Stay")
    expect(clock.size).toBe(0)
  })
})

describe("swap", () => {
  it("cycles round and never runs faster than 1.2s", () => {
    expect([0, 1, 2].map((i) => swapNext(i, 3))).toEqual([1, 2, 0])
    expect(swapNext(0, 0)).toBe(0)
    expect(swapInterval(undefined)).toBe(2400)
    expect(swapInterval(100)).toBe(1200)
  })
  it("finds the slot, or appends the words, and names the sentence with the first word", () => {
    expect(swapParts("Design that feels {word}.", ["calm", "bright"])).toEqual({ before: "Design that feels ", after: ".", name: "Design that feels calm." })
    expect(swapParts("Design that feels", ["calm"]).name).toBe("Design that feels calm")
  })
})
