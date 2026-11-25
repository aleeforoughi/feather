import { describe, expect, it, vi } from "vitest"
import { linearToOklab, paletteUniform, parseColor, resolvePalette, srgbToLinear, themePalette } from "./palette"
import { ShaderError } from "./gl"

const round = (c: readonly number[] | null) => c?.map((v) => +v.toFixed(4))

describe("palette parsing", () => {
  it("reads hex and rgb() directly, in linear light", () => {
    expect(round(parseColor("#ffffff"))).toEqual([1, 1, 1])
    expect(round(parseColor("#f00"))).toEqual([1, 0, 0])
    expect(round(parseColor("#80808080"))).toEqual(round([srgbToLinear(128 / 255), srgbToLinear(128 / 255), srgbToLinear(128 / 255)]))
    expect(round(parseColor("rgb(255, 0, 0)"))).toEqual([1, 0, 0])
    expect(round(parseColor("rgb(0 0 255 / 50%)"))).toEqual([0, 0, 1])
    expect(round(parseColor("rgba(100%, 0%, 0%, 1)"))).toEqual([1, 0, 0])
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3)
  })

  it("any other colour goes through a 1×1 canvas; one the browser rejects is null", () => {
    // jsdom has no 2D canvas: a small one that knows two colours stands in for the browser.
    const known: Record<string, [number, number, number]> = { "oklch(0.7 0.1 200)": [64, 160, 170], black: [0, 0, 0] }
    let style = "#000000"
    let painted: [number, number, number] = [0, 0, 0]
    const ctx = {
      get fillStyle() {
        return style
      },
      set fillStyle(v: string) {
        if (v === "#000") style = "#000000"
        else if (v === "#fff") style = "#ffffff"
        else if (known[v]) style = v
      },
      clearRect() {},
      fillRect() {
        painted = known[style] ?? (style === "#ffffff" ? [255, 255, 255] : [0, 0, 0])
      },
      getImageData: () => ({ data: [...painted, 255] }),
    }
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    expect(round(parseColor("oklch(0.7 0.1 200)"))).toEqual(round([srgbToLinear(64 / 255), srgbToLinear(160 / 255), srgbToLinear(170 / 255)]))
    expect(parseColor("black")).toEqual([0, 0, 0])
    expect(parseColor("not-a-colour")).toBeNull()
    expect(parseColor("")).toBeNull()
    spy.mockRestore()
  })

  it("converts to OKLab: white is L 1, greys have no chroma", () => {
    const [l, a, b] = linearToOklab([1, 1, 1])
    expect(l).toBeCloseTo(1, 3)
    expect(Math.abs(a) + Math.abs(b)).toBeLessThan(1e-3)
    const [, ga, gb] = linearToOklab([0.2, 0.2, 0.2])
    expect(Math.abs(ga) + Math.abs(gb)).toBeLessThan(1e-3)
  })

  it("reads the theme's colours where the scene is, without repeats", () => {
    const el = document.createElement("div")
    el.style.setProperty("--background", "#ffffff")
    el.style.setProperty("--primary", "#000000")
    el.style.setProperty("--accent", "#ff0000")
    el.style.setProperty("--block-1", "#000000")
    el.style.setProperty("--block-2", "#0000ff")
    document.body.appendChild(el)
    expect(themePalette(el).map(round)).toEqual([
      [1, 1, 1],
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ])
    expect(themePalette(el, 3)).toHaveLength(3)
    // Given colours win; one given colour becomes the ground for the theme's others.
    expect(resolvePalette(["#00ff00", "#0000ff"], el).map(round)).toEqual([
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(resolvePalette(["#00ff00"], el).map(round)[0]).toEqual([0, 1, 0])
    el.remove()
  })

  it("never returns fewer than two stops, even with no theme", () => {
    expect(themePalette(null)).toHaveLength(2)
    expect(themePalette(document.createElement("div")).length).toBeGreaterThanOrEqual(2)
  })

  it("fills a shader's palette slots by repeating the stops", () => {
    const u = paletteUniform([
      [1, 0, 0],
      [0, 1, 0],
    ])
    expect([...u]).toEqual([1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0])
  })
})

describe("ShaderError", () => {
  it("names the shader and shows the lines the driver points at", () => {
    const source = ["precision mediump float;", "void main() {", "  gl_FragColor = wobble;", "}"].join("\n")
    const error = new ShaderError("aurora", "fragment", "ERROR: 0:3: 'wobble' : undeclared identifier", source)
    expect(error.message).toContain("the fragment shader of aurora did not compile")
    expect(error.message).toContain(">    3 |   gl_FragColor = wobble;")
    expect(error.message).toContain("     2 | void main() {")
  })
})
