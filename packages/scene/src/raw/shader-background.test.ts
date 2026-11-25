import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WorldFrame } from "@aleeforoughi/feather-expression/core"
import { installFakeWebGL } from "../test/fake-webgl"
import { ShaderError } from "../shared/gl"
import { GRAIN_FPS, SHADER_LEVELS, shaderBackground, type ShaderBackgroundOptions } from "./shader-background"

let fakes: ReturnType<typeof installFakeWebGL>
beforeEach(() => {
  fakes = installFakeWebGL()
})
afterEach(() => {
  fakes.restore()
  vi.restoreAllMocks()
})

const PALETTE = ["#0b0b0f", "#3a2bd9", "#f2a65a"]
const setup = (options: ShaderBackgroundOptions = {}) => {
  const canvas = document.createElement("canvas")
  const bg = shaderBackground({ palette: PALETTE, ...options })
  const base = { canvas, width: 800, height: 400, pixelRatio: 2, quality: "high" as const }
  let time = 0
  const frame = (delta = 16): boolean => {
    time += delta
    return bg.frame({ ...base, time, delta } satisfies WorldFrame)
  }
  bg.resize?.(base)
  return { canvas, bg, frame, base, gl: () => fakes.of(canvas)! }
}

describe("shaderBackground", () => {
  it("compiles its program once however many frames it draws, and frees every GL object on dispose", () => {
    const { bg, frame, gl } = setup()
    for (let i = 0; i < 20; i++) frame()
    expect(gl().named("createProgram")).toHaveLength(1)
    expect(gl().named("compileShader")).toHaveLength(2)
    expect(gl().named("drawArrays")).toHaveLength(20)
    expect(gl().live("program")).toBe(1)
    bg.dispose()
    expect(gl().named("deleteProgram")).toHaveLength(1)
    expect(gl().live("program")).toBe(0)
    expect(gl().live("buffer")).toBe(0)
    expect(gl().live("shader")).toBe(0)
  })

  it("the flow preset frees its flowmap too, and its pointer listener", () => {
    const add = vi.spyOn(window, "addEventListener")
    const remove = vi.spyOn(window, "removeEventListener")
    const { bg, frame, gl } = setup({ preset: "flow" })
    frame()
    expect(gl().live("program")).toBe(2)
    expect(gl().live("texture")).toBe(2)
    expect(gl().live("framebuffer")).toBe(2)
    const move = add.mock.calls.find(([type]) => type === "pointermove")!
    expect(move[2]).toMatchObject({ passive: true })
    bg.dispose()
    expect(gl().live("program") + gl().live("texture") + gl().live("framebuffer") + gl().live("buffer")).toBe(0)
    expect(remove.mock.calls.some(([type, fn]) => type === "pointermove" && fn === move[1])).toBe(true)
  })

  it("draws at the World's pixel ratio times its resolution share", () => {
    const { canvas, frame } = setup()
    expect([canvas.width, canvas.height]).toEqual([800 * 2 * 0.75, 400 * 2 * 0.75])
    frame()
    expect(fakes.of(canvas)!.uniform("u_resolution")).toEqual([1200, 600])
    const full = setup({ resolution: 1 })
    expect(full.canvas.width).toBe(1600)
    // The share stays within 0.5..1.
    expect(setup({ resolution: 0.1 }).canvas.width).toBe(800)
  })

  it("never reads the device pixel ratio itself", () => {
    const spy = vi.spyOn(window, "devicePixelRatio", "get").mockImplementation(() => {
      throw new Error("read devicePixelRatio")
    })
    const { frame } = setup()
    expect(() => frame()).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it("has three levels, each drawing fewer pixels and fewer octaves", () => {
    const { bg, canvas, frame, gl } = setup()
    expect(bg.levels).toBe(3)
    frame()
    const rich = { pixels: canvas.width * canvas.height, octaves: gl().uniform("u_octaves")![0] as number }
    bg.setLevel(2)
    frame()
    const light = { pixels: canvas.width * canvas.height, octaves: gl().uniform("u_octaves")![0] as number }
    expect(rich.octaves).toBe(SHADER_LEVELS.octaves["gradient-noise"][0])
    expect(light.octaves).toBeLessThan(rich.octaves)
    expect(light.pixels).toBeLessThan(rich.pixels / 2)
    expect(canvas.width).toBe(Math.round(800 * 2 * 0.75 * SHADER_LEVELS.share[2]))
  })

  it("renders on demand: at speed 0 it draws once and rests; at speed 1 it animates", () => {
    const still = setup({ speed: 0 })
    expect(still.frame()).toBe(false)
    expect(still.frame()).toBe(false)
    expect(still.gl().named("drawArrays")).toHaveLength(1)
    still.bg.update({ intensity: 0.2 })
    still.frame()
    expect(still.gl().named("drawArrays")).toHaveLength(2)

    const moving = setup({ speed: 1 })
    expect(moving.frame()).toBe(true)
    const first = moving.gl().uniform("u_loop")
    moving.frame()
    expect(moving.gl().uniform("u_loop")).not.toEqual(first)
  })

  it("hands the shader time only as cos and sin, so values stay within -1..1 after hours", () => {
    const { frame, gl } = setup({ speed: 2 })
    frame(50)
    for (let i = 0; i < 2000; i++) frame(50)
    for (const v of [...gl().uniform("u_loop")!, ...gl().uniform("u_loop2")!]) expect(Math.abs(v as number)).toBeLessThanOrEqual(1)
  })

  it("the grain field steps at its own rate, not every frame", () => {
    const { frame, gl } = setup({ preset: "grain-field" })
    for (let i = 0; i < 60; i++) expect(frame(1000 / 60)).toBe(true)
    const draws = gl().named("drawArrays").length
    expect(draws).toBeGreaterThanOrEqual(GRAIN_FPS - 1)
    expect(draws).toBeLessThanOrEqual(GRAIN_FPS + 1)
  })

  it("prewarm compiles in one task, before the first frame", () => {
    const { bg, gl } = setup()
    const tasks = bg.prewarm()
    expect(tasks).toHaveLength(1)
    expect(gl().named("createProgram")).toHaveLength(0)
    tasks[0]()
    expect(gl().named("createProgram")).toHaveLength(1)
  })

  it("stops drawing when the context is lost, reports it, and rebuilds when it is restored", () => {
    const onStop = vi.fn()
    const { bg, frame, gl } = setup({ onStop })
    const states: string[] = []
    bg.subscribe((s) => states.push(s))
    frame()
    gl().lose()
    expect(bg.state).toBe("lost")
    expect(onStop).toHaveBeenCalledWith({ reason: "context-lost" })
    const draws = gl().named("drawArrays").length
    expect(frame()).toBe(false)
    expect(gl().named("drawArrays")).toHaveLength(draws)
    gl().restore()
    expect(frame()).toBe(true)
    expect(gl().named("createProgram")).toHaveLength(2)
    expect(gl().named("drawArrays")).toHaveLength(draws + 1)
    expect(states).toEqual(["ready", "lost", "idle", "ready"])
  })

  it("a shader that does not compile fails for good with a readable error", () => {
    const onStop = vi.fn()
    const { bg, frame, gl } = setup({ onStop })
    gl().failNextCompile("ERROR: 0:12: 'wobble' : undeclared identifier")
    expect(frame()).toBe(false)
    expect(bg.state).toBe("failed")
    const error = onStop.mock.calls[0][0].error as ShaderError
    expect(error).toBeInstanceOf(ShaderError)
    expect(error.stage).toBe("fragment")
    expect(error.message).toContain("the fragment shader of gradient-noise did not compile")
    expect(error.message).toMatch(/>\s+12 \|/)
    expect(gl().live("shader")).toBe(0)
    // Failed is final: later frames never try to compile again.
    expect(frame()).toBe(false)
    expect(gl().named("compileShader")).toHaveLength(2)
  })

  it("a context without WebGL fails at once (the page keeps its still)", () => {
    fakes.restore()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const onStop = vi.fn()
    const bg = shaderBackground({ onStop })
    const canvas = document.createElement("canvas")
    expect(bg.frame({ canvas, width: 10, height: 10, pixelRatio: 1, quality: "low", time: 0, delta: 0 })).toBe(false)
    expect(bg.state).toBe("failed")
    expect(onStop).toHaveBeenCalledWith({ reason: "no-webgl" })
    fakes = installFakeWebGL()
  })

  it("rebinds to a new canvas after dispose (a remount), compiling again for the new context", () => {
    const { bg, frame, base, gl } = setup()
    frame()
    bg.dispose()
    const next = document.createElement("canvas")
    bg.resize?.({ ...base, canvas: next })
    expect(bg.frame({ ...base, canvas: next, time: 1, delta: 16 })).toBe(true)
    expect(fakes.of(next)!.named("createProgram")).toHaveLength(1)
    expect(gl().named("createProgram")).toHaveLength(1)
  })

  it("uploads the palette in linear light and OKLab, ground first", () => {
    const { frame, gl } = setup({ palette: ["#ffffff", "#000000", "#ff0000"] })
    frame()
    const rgb = gl().named("uniform3fv").find((c) => (c.args[0] as { uniform: string }).uniform === "u_rgb")!.args[1] as Float32Array
    expect([...rgb.slice(0, 9)].map((v) => +v.toFixed(3))).toEqual([1, 1, 1, 0, 0, 0, 1, 0, 0])
    expect(gl().uniform("u_stops")).toEqual([3])
  })
})
