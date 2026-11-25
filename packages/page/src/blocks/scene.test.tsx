// The scene layer (feather.page/1 `scene`, wave 4). The server writes the poster and the model's list of parts, never a
// canvas. In the browser the scene runs only where the gate, the loudness and the person allow it; anywhere else (no
// WebGL here, in jsdom) the poster stays, nothing moves and Three.js is never requested.
import fs from "node:fs"
import path from "node:path"
import { act, render } from "@testing-library/react"
import { renderToStaticMarkup, renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { FeatherPage } from "../render"
import { validatePage } from "../core/validate"
import type { BlockScene, PageDocument } from "../core/types"
import { BLOCKS, PLACEHOLDER } from "./fixtures"
import { SceneLayer, sceneQuality } from "./scene"

const three = vi.hoisted(() => ({ loaded: 0 }))
vi.mock("@aleeforoughi/feather-scene/three", () => {
  three.loaded++
  return { objectViewer: vi.fn(), particleField: vi.fn(), cameraRail: vi.fn(), attachKeys: vi.fn(() => () => {}) }
})

const studio = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../../tokens/themes/studio.json"), "utf8")).tokens
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html")

const MODEL: BlockScene = {
  kind: "model",
  model: "media/sensor.glb",
  hotspots: [
    { id: "light", position: [0, 0.4, 0.6], label: "Status light" },
    { id: "ring", position: [0.7, 0, 0], label: "Grip ring" },
  ],
  variants: [
    { id: "frost", label: "Frost", colors: { body: "--primary" } },
    { id: "ember", label: "Ember", colors: { body: "--accent" } },
  ],
}

function page(sections: unknown[]): PageDocument {
  const r = validatePage({ schema: "feather.page/1", brand: "b.json", loudness: 3, sections })
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.page
}

const loud = () =>
  page([
    { ...BLOCKS.hero, variant: "interactive", media: undefined, scene: { kind: "shader", preset: "aurora" } },
    { ...BLOCKS.case, scene: MODEL },
    { ...BLOCKS.signature, scene: { kind: "depth", depth: "media/photo-depth.png" }, media: PLACEHOLDER },
  ])

describe("the scene in the server markup", () => {
  it("writes every scene's poster and the model's parts, never a canvas", () => {
    const html = renderToStaticMarkup(<FeatherPage page={loud()} tokens={studio} />)
    const doc = parse(html)
    expect(doc.querySelector("canvas")).toBeNull()
    const layers = [...doc.querySelectorAll('[data-slot="scene-layer"]')]
    expect(layers.map((l) => [l.getAttribute("data-variant"), l.getAttribute("data-placement"), l.getAttribute("data-state")])).toEqual([
      ["shader", "behind", "poster"],
      ["model", "frame", "poster"],
      ["depth", "frame", "poster"],
    ])
    for (const layer of layers) {
      expect(layer.querySelector('[data-slot="world"][data-variant="static"]')).not.toBeNull()
      expect(layer.querySelector('[data-slot="world-still"] [data-slot="scene-poster"]')).not.toBeNull()
    }
    // The hero has no media: its poster is a field in the theme's colours, tokens only.
    const field = layers[0].querySelector<HTMLElement>('[data-slot="scene-poster"]')!
    expect(field.getAttribute("data-variant")).toBe("field")
    expect(field.style.background).toContain("var(--primary)")
    expect(field.style.background).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
    // The model's parts and finishes are in the DOM, visually hidden, with no script at all.
    const parts = layers[1].querySelector('[data-slot="scene-parts"]')!
    expect(parts.className).toContain("sr-only")
    expect([...parts.querySelectorAll('[data-slot="scene-hotspot-item"]')].map((li) => li.textContent)).toEqual(["Status light", "Grip ring"])
    expect(parts.querySelector('[data-slot="scene-variant-list"]')?.textContent).toBe("Finishes: Frost, Ember.")
    // The buttons over the canvas, the keys and the finishes exist only once the scene runs.
    expect(layers[1].querySelector('[data-slot="scene-hotspot"], [data-slot="scene-keys"], [data-slot="scene-variants"]')).toBeNull()
    // The poster of a block with media is its image, with an empty alt (the World is decoration); the frame names it.
    const signature = layers[2]
    expect(signature.querySelector("img[data-slot=scene-poster]")?.getAttribute("src")).toBe(PLACEHOLDER.src)
    expect(signature.querySelector("img[data-slot=scene-poster]")?.getAttribute("alt")).toBe("")
    expect(signature.querySelector('[data-slot="scene-frame"]')?.getAttribute("aria-label")).toBe(PLACEHOLDER.alt)
    // One h1, the hero's words in the DOM over its scene.
    expect(doc.querySelectorAll("h1")).toHaveLength(1)
    expect(doc.querySelector('[data-block="hero"]')?.getAttribute("data-block-variant")).toBe("interactive")
    expect(doc.querySelector('[data-block="hero"]')?.className).toContain("isolate")
  })

  it("the hero's poster image is the LCP: eager and high priority, never lazy", () => {
    const html = renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "interactive", scene: { kind: "shader" } }])} tokens={studio} />)
    const img = parse(html).querySelector<HTMLImageElement>('[data-slot="scene-poster"]')!
    expect(img.getAttribute("loading")).toBe("eager")
    expect(img.getAttribute("fetchpriority")).toBe("high")
  })

  it("the interactive hero without a scene is still giant-type, and a model hero stands its stage under the words", () => {
    const plain = parse(renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "interactive" }])} tokens={studio} />))
    expect(plain.querySelector('[data-slot="scene-layer"]')).toBeNull()
    const withModel = parse(renderToStaticMarkup(<FeatherPage page={page([{ ...BLOCKS.hero, variant: "interactive", scene: MODEL }])} tokens={studio} />))
    const layer = withModel.querySelector('[data-slot="scene-layer"]')!
    expect(layer.getAttribute("data-placement")).toBe("frame")
    expect(withModel.querySelector('[data-slot="hero-copy"]')!.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe("the scene in the browser", () => {
  it("keeps the poster where the scene cannot run (no WebGL in jsdom): no canvas, no Three.js, the parts still listed", async () => {
    const before = three.loaded
    const html = renderToString(<FeatherPage page={loud()} tokens={studio} />)
    const host = document.createElement("div")
    host.innerHTML = html
    document.body.append(host)
    const { container } = render(<FeatherPage page={loud()} tokens={studio} />, { container: host, hydrate: true })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(container.querySelector("canvas")).toBeNull()
    expect([...container.querySelectorAll('[data-slot="scene-layer"]')].every((l) => l.getAttribute("data-state") === "poster")).toBe(true)
    expect(container.querySelectorAll('[data-slot="scene-hotspot-item"]')).toHaveLength(2)
    expect(container.querySelector('[data-slot="scene-pause"]')).toBeNull()
    expect(three.loaded).toBe(before)
    host.remove()
  })

  it("quality poster never runs, even where everything else would allow it", async () => {
    const { container } = render(<SceneLayer scene={{ kind: "particles", quality: "poster" }} label="Dust" />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(container.querySelector("canvas")).toBeNull()
    expect(container.querySelector('[data-slot="scene-layer"]')?.getAttribute("data-state")).toBe("poster")
  })

  it("the quality knob is a ceiling under what the device allows", () => {
    expect(sceneQuality("high", "auto")).toBe("high")
    expect(sceneQuality("high", undefined)).toBe("high")
    expect(sceneQuality("high", "low")).toBe("low")
    expect(sceneQuality("low", "high")).toBe("low")
    expect(sceneQuality("medium", "medium")).toBe("medium")
    expect(sceneQuality("high", "poster")).toBe("static")
    expect(sceneQuality("static", "high")).toBe("static")
  })
})
