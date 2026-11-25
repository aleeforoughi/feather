import * as React from "react"
import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { World } from "@aleeforoughi/feather-expression"
import { installFakeWebGL } from "../test/fake-webgl"
import { useScene } from "../shared/use-scene"
import { shaderBackground, type ShaderBackground } from "./shader-background"

const rafs: Array<(t: number) => void> = []
let fakes: ReturnType<typeof installFakeWebGL>
beforeEach(() => {
  rafs.length = 0
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => rafs.push(cb))
  vi.stubGlobal("cancelAnimationFrame", () => {})
  fakes = installFakeWebGL()
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(360)
})
afterEach(() => {
  fakes.restore()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
let now = 0
const flush = () => act(() => void rafs.splice(0).forEach((cb) => cb((now += 16))))

function Hero({ scene }: { scene: ShaderBackground }) {
  return <World still={<p data-slot="poster">The still</p>} {...useScene(scene, "medium")} />
}

describe("a shader background inside the World", () => {
  it("runs on the World's clock at its capped ratio, and frees everything when the World unmounts", () => {
    const scene = shaderBackground({ palette: ["#111", "#eee"] })
    const { container, unmount } = render(<Hero scene={scene} />)
    const canvas = container.querySelector("canvas")!
    flush()
    flush()
    const gl = fakes.of(canvas)!
    expect(gl.named("drawArrays").length).toBeGreaterThanOrEqual(2)
    expect(gl.named("createProgram")).toHaveLength(1)
    // medium caps the ratio at 1.5 (jsdom reports 1, so 1); the share is 0.75.
    expect(canvas.width).toBe(Math.round(640 * 0.75))
    expect(container.querySelector('[data-slot="world"]')!.getAttribute("data-state")).toBe("ready")
    unmount()
    expect(gl.live("program") + gl.live("buffer")).toBe(0)
  })

  it("a lost context puts the still back (the World turns static)", () => {
    const scene = shaderBackground()
    const { container } = render(<Hero scene={scene} />)
    const canvas = container.querySelector("canvas")!
    flush()
    act(() => fakes.of(canvas)!.lose())
    const world = container.querySelector('[data-slot="world"]')!
    expect(world.getAttribute("data-variant")).toBe("static")
    expect(container.querySelector("canvas")).toBeNull()
    expect(container.querySelector('[data-slot="world-still"]')!.className).not.toContain("invisible")
    flush()
    expect(scene.state).toBe("lost")
  })

  it("is never drawn when the World is static", () => {
    const scene = shaderBackground()
    const frame = vi.spyOn(scene, "frame")
    render(React.createElement(World, { renderer: scene, quality: "static", still: "/poster.jpg" }))
    flush()
    expect(frame).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
  })
})
