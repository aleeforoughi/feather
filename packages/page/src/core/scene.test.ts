// The scene knob (feather.page/1, wave 4): every kind and preset validates on the blocks that take one, every bad value
// is refused with its JSON pointer and a code, a scene on a /0 page names the schema it needs, and the contradictions
// (below loudness 3, a model without its GLB, a depth scene without both images) are errors.
import { describe, expect, it } from "vitest"
import { pageJsonSchema } from "../../scripts/json-schema"
import { SCENE_BLOCKS, SCENE_KINDS, SCENE_PRESETS, SCENE_QUALITIES } from "./spec"
import { validatePage } from "./validate"

const page = (sections: unknown[], extra: Record<string, unknown> = {}) => ({ schema: "feather.page/1", brand: "b.json", loudness: 3, sections, ...extra })
const issues = (doc: unknown) => {
  const r = validatePage(doc)
  return r.ok ? [] : r.issues.map((i) => `${i.path} ${i.code}`)
}
const ok = (doc: unknown) => expect(issues(doc)).toEqual([])

const hero = (scene: unknown, extra: Record<string, unknown> = {}) => ({ block: "hero", title: "Hello", variant: "interactive", scene, ...extra })
const model = { kind: "model", model: "media/flask.glb", hotspots: [{ id: "cap", position: [0, 2.3, 0], label: "Twist cap" }], variants: [{ id: "graphite", label: "Graphite", colors: { body: "--primary" } }, { id: "ember", label: "Ember", colors: { body: "--accent", cap: "var(--block-2)" } }] }

describe("the scene knob validates", () => {
  it("takes every kind, every preset of its kind and every quality, on the interactive hero, the case and the signature", () => {
    for (const kind of SCENE_KINDS) {
      const base = kind === "model" ? model : kind === "depth" ? { kind, depth: "media/photo-depth.png" } : { kind }
      const media = kind === "depth" ? { media: { src: "media/photo.jpg", alt: "A photo" } } : {}
      for (const preset of [undefined, ...SCENE_PRESETS[kind]]) {
        for (const quality of SCENE_QUALITIES) {
          const scene = { ...base, ...(preset ? { preset } : {}), quality }
          ok(page([hero(scene, media), { block: "case", title: "A case", scene, ...media }, { block: "signature", title: "Ours", scene, ...media }]))
        }
      }
    }
    expect([...SCENE_BLOCKS]).toEqual(["hero", "case", "signature"])
  })

  it("refuses bad values with their pointers", () => {
    expect(
      issues(
        page([
          hero({ kind: "splat", preset: "fire", quality: "ultra", hotspots: [{ id: "a", position: [0, 1], label: "A" }], depth: 3, extra: true }),
          { block: "case", title: "Case", scene: { kind: "model", model: "media/flask.glb", hotspots: [{ id: "a", position: [0, 0, 500], label: "A" }, { id: "a", position: [0, 0, 0], label: "B" }], variants: [{ id: "x", label: "X", colors: {} }] } },
        ])
      )
    ).toEqual([
      "/sections/0/scene/extra unknown-field",
      "/sections/0/scene/kind type",
      "/sections/0/scene/preset unknown-variant",
      "/sections/0/scene/quality type",
      "/sections/0/scene/depth bad-media",
      "/sections/0/scene/hotspots/0/position type",
      "/sections/1/scene/hotspots/0/position out-of-range",
      "/sections/1/scene/variants too-few",
      "/sections/1/scene/variants/0/colors too-few",
      "/sections/1/scene/hotspots/1/id duplicate-id",
    ])
  })

  it("is a knob of /1: a scene on a /0 page names the schema it needs", () => {
    expect(issues({ schema: "feather.page/0", brand: "b.json", sections: [{ block: "case", title: "Case", scene: { kind: "shader" } }] })).toEqual(["/sections/0/scene needs-schema-1"])
  })

  it("only the hero, the case and the signature take a scene", () => {
    expect(issues(page([{ block: "hero", title: "Hi" }, { block: "statement", title: "Words", scene: { kind: "shader" } }]))).toEqual(["/sections/1/scene unknown-field"])
  })

  it("refuses contradictions: below loudness 3, the wrong hero or case, presets and fields of another kind, missing assets", () => {
    expect(issues(page([hero({ kind: "shader" })], { loudness: 2 }))).toEqual(["/sections/0/scene contradiction"])
    expect(issues(page([hero({ kind: "shader" }, { loudness: 1 })]))).toEqual(["/sections/0/scene contradiction"])
    // The brand's own default decides where nothing is declared.
    ok({ schema: "feather.page/1", brand: "b.json", sections: [hero({ kind: "shader" })] })
    expect(issues(page([{ block: "hero", title: "Hi", variant: "film", media: "a.jpg", scene: { kind: "shader" } }]))).toEqual(["/sections/0/scene contradiction"])
    expect(issues(page([{ block: "hero", title: "Hi", scene: { kind: "shader" } }]))).toEqual(["/sections/0/scene contradiction"])
    expect(issues(page([{ block: "case", title: "C", variant: "scale", media: "a.jpg", scene: { kind: "shader" } }]))).toEqual(["/sections/0/scene contradiction"])
    expect(issues(page([hero({ kind: "particles", preset: "aurora" })]))).toEqual(["/sections/0/scene/preset unsupported"])
    expect(issues(page([hero({ kind: "model", model: "a.glb", preset: "dust" })]))).toEqual(["/sections/0/scene/preset unsupported"])
    expect(issues(page([hero({ kind: "shader", model: "a.glb", hotspots: model.hotspots, depth: "d.png" })]))).toEqual(["/sections/0/scene/model unsupported", "/sections/0/scene/hotspots unsupported", "/sections/0/scene/depth unsupported"])
    expect(issues(page([hero({ kind: "model" })]))).toEqual(["/sections/0/scene/model missing"])
    expect(issues(page([hero({ kind: "model", model: "media/flask.png" })]))).toEqual(["/sections/0/scene/model bad-media"])
    expect(issues(page([hero({ kind: "depth" })]))).toEqual(["/sections/0/media missing", "/sections/0/scene/depth missing"])
    expect(issues(page([hero({ kind: "depth", depth: "d.png" })]))).toEqual(["/sections/0/media missing"])
    expect(issues(page([hero({ kind: "depth" }, { media: "a.jpg" })]))).toEqual(["/sections/0/scene/depth missing"])
    expect(issues(page([hero({ kind: "model", model: "a.glb", hotspots: [{ id: "Cap", position: [0, 0, 0], label: "Cap" }] })]))).toEqual(["/sections/0/scene/hotspots/0/id type"])
  })

  it("is in the generated JSON Schema of /1, and not of /0", () => {
    const blocks = (v: 0 | 1) => (pageJsonSchema(v).$defs as { block: { oneOf: { properties: Record<string, { properties?: Record<string, unknown> }> }[] } }).block.oneOf
    const byName = (v: 0 | 1) => Object.fromEntries(blocks(v).map((b) => [(b.properties.block as unknown as { const: string }).const, b.properties]))
    for (const name of SCENE_BLOCKS) {
      const scene = byName(1)[name].scene as { properties: Record<string, { enum?: string[]; minItems?: number }> }
      expect(scene.properties.kind.enum).toEqual([...SCENE_KINDS])
      expect(scene.properties.quality.enum).toEqual([...SCENE_QUALITIES])
      expect((scene.properties.hotspots as unknown as { items: { properties: { position: { minItems: number; maxItems: number } } } }).items.properties.position).toMatchObject({ minItems: 3, maxItems: 3 })
      expect(byName(0)[name].scene).toBeUndefined()
    }
    expect(byName(1).statement.scene).toBeUndefined()
  })
})
