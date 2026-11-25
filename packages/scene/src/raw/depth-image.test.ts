import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WorldController, WorldFrame } from "@aleeforoughi/feather-expression/core"
import { installFakeWebGL } from "../test/fake-webgl"
import { DEPTH_LEVELS, depthImage, type DepthImageOptions } from "./depth-image"

// jsdom never loads images: this one loads on the next microtask at a fixed size.
class FakeImage {
  naturalWidth = 1600
  naturalHeight = 1000
  width = 1600
  height = 1000
  crossOrigin = ""
  decoding = ""
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(value: string) {
    queueMicrotask(() => (value.includes("missing") ? this.onerror?.() : this.onload?.()))
  }
}

let fakes: ReturnType<typeof installFakeWebGL>
beforeEach(() => {
  fakes = installFakeWebGL()
  vi.stubGlobal("Image", FakeImage)
})
afterEach(() => {
  fakes.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const settle = () => new Promise((r) => setTimeout(r, 0))
const setup = (options: Partial<DepthImageOptions> = {}) => {
  const canvas = document.createElement("canvas")
  const scene = depthImage({ image: "photo.jpg", depth: "depth.png", ...options })
  const base = { canvas, width: 1000, height: 500, pixelRatio: 1.5, quality: "high" as const }
  let time = 0
  const frame = (delta = 16) => {
    time += delta
    return scene.frame({ ...base, time, delta } satisfies WorldFrame)
  }
  scene.resize?.(base)
  return { canvas, scene, frame, gl: () => fakes.of(canvas)! }
}

describe("depthImage", () => {
  it("draws nothing until the photo and its depth are in, then uploads both once", async () => {
    const { scene, frame, gl } = setup()
    frame()
    expect(gl().named("drawArrays")).toHaveLength(0)
    expect(scene.state).toBe("idle")
    await settle()
    frame()
    frame()
    expect(gl().named("texImage2D")).toHaveLength(2)
    expect(gl().named("createProgram")).toHaveLength(1)
    expect(gl().named("drawArrays").length).toBeGreaterThan(0)
    expect(scene.state).toBe("ready")
  })

  it("asks the World for a frame when the images arrive, instead of polling", async () => {
    const { scene, frame } = setup()
    const invalidate = vi.fn()
    scene.connect({ invalidate } as unknown as WorldController)
    expect(frame()).toBe(false)
    await settle()
    expect(invalidate).toHaveBeenCalled()
  })

  it("without a fine pointer or tilt it drifts (an animation), within the edge-safe zoom", async () => {
    const { frame, gl } = setup({ strength: 1, focus: 0 })
    await settle()
    frame()
    expect(frame(100)).toBe(true)
    const [cx, cy] = gl().uniform("u_cover") as number[]
    const [sx, sy] = gl().uniform("u_shift") as number[]
    // The shown half-extent plus the largest possible shift stays inside the photo.
    expect(cx / 2 + 0.05 * cx).toBeLessThanOrEqual(0.5 + 1e-6)
    expect(cy / 2 + 0.05 * 2 * cy).toBeLessThanOrEqual(0.5 + 1e-6)
    expect(Math.abs(sx)).toBeLessThanOrEqual(0.05 * cx + 1e-6)
    expect(Math.abs(sy)).toBeLessThanOrEqual(0.05 * 2 * cy + 1e-6)
  })

  it("a fine pointer at rest renders on demand, and a move asks for a frame", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: fine)", media: q }) as MediaQueryList)
    const { scene, frame } = setup()
    const invalidate = vi.fn()
    scene.connect({ invalidate } as unknown as WorldController)
    await settle()
    expect(frame()).toBe(false)
    window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 900, clientY: 100, pointerType: "mouse" }))
    expect(invalidate).toHaveBeenCalled()
    expect(frame()).toBe(true)
  })

  it("draws at the World's pixel ratio times its share, and its levels lower the share and the steps", async () => {
    const { scene, canvas, frame, gl } = setup()
    expect([canvas.width, canvas.height]).toEqual([1500, 750])
    await settle()
    frame()
    expect(gl().uniform("u_steps")).toEqual([DEPTH_LEVELS.steps[0]])
    scene.setLevel(2)
    frame()
    expect(gl().uniform("u_steps")).toEqual([1])
    expect(canvas.width).toBe(Math.round(1500 * DEPTH_LEVELS.share[2]))
  })

  it("frees both textures, the buffer and the program on dispose", async () => {
    const { scene, frame, gl } = setup()
    await settle()
    frame()
    scene.dispose()
    expect(gl().live("texture") + gl().live("program") + gl().live("buffer")).toBe(0)
  })

  it("an image that does not load stops the scene (the still stays)", async () => {
    const onStop = vi.fn()
    const { scene, frame } = setup({ depth: "missing.png", onStop })
    frame()
    await settle()
    expect(scene.state).toBe("failed")
    expect(onStop.mock.calls[0][0].reason).toBe("asset")
    expect(frame()).toBe(false)
  })

  it("stops on context loss", async () => {
    const { scene, frame, gl } = setup()
    await settle()
    frame()
    const draws = gl().named("drawArrays").length
    gl().lose()
    expect(scene.state).toBe("lost")
    expect(frame()).toBe(false)
    expect(gl().named("drawArrays")).toHaveLength(draws)
  })
})
