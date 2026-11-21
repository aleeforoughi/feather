import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { pageJsonSchema } from "../../scripts/json-schema.ts"
import { BLOCK_KINDS } from "../../../living/src/core/blocks"
import { BLOCK_NAMES } from "./spec"
import { resolveRefs, validatePage } from "./validate"

// The reference page, loosely typed so a test can break it on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>
const example = (): Doc => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../examples/studio-of-one.page.json"), "utf8"))
const issues = (doc: unknown) => {
  const r = validatePage(doc)
  return r.ok ? [] : r.issues
}
const codes = (doc: unknown) => issues(doc).map((i) => `${i.path} ${i.code}`)

describe("validatePage", () => {
  it("accepts the reference page", () => {
    expect(issues(example())).toEqual([])
  })

  it("has exactly the Living Page library as its blocks", () => {
    expect(BLOCK_NAMES).toEqual([...BLOCK_KINDS])
  })

  it.each([
    ["wrong schema", (d: Doc) => (d.schema = "feather.page/1"), "/schema wrong-schema"],
    ["no sections", (d: Doc) => (d.sections = []), "/sections too-few"],
    ["unknown block", (d: Doc) => d.sections.push({ block: "carousel" }), "/sections/6/block unknown-block"],
    ["missing title", (d: Doc) => delete d.sections[0].title, "/sections/0/title missing"],
    ["unknown field", (d: Doc) => (d.sections[0].color = "red"), "/sections/0/color unknown-field"],
    ["unknown work ref", (d: Doc) => d.sections[1].items.push("nope"), "/sections/1/items/3 unknown-ref"],
    ["javascript href", (d: Doc) => (d.sections[5].actions[0].href = "javascript:alert(1)"), "/sections/5/actions/0/href bad-href"],
    ["media without alt", (d: Doc) => (d.sections[0].media = { src: "/hero.avif" }), "/sections/0/media/alt missing"],
    ["duplicate id", (d: Doc) => (d.sections[1].id = "top"), "/sections/1/id duplicate-id"],
    ["too many numbers", (d: Doc) => d.sections[2].items.push(...d.sections[2].items), "/sections/2/items too-many"],
    ["four blocks in a scene", (d: Doc) => d.scenes.now.blocks.push({ block: "statement", title: "a" }, { block: "statement", title: "b" }, { block: "statement", title: "c" }), "/scenes/now/blocks too-many"],
    ["prepared scene missing", (d: Doc) => d.living.prepared.push("pricing"), "/living/prepared/4 unknown-scene"],
    ["living without a speaker", (d: Doc) => delete d.speaker, "/speaker no-speaker"],
    ["a disclosure that hides the agent", (d: Doc) => (d.living.disclosure = "Ask me anything"), "/living/disclosure type"],
    ["a title too long", (d: Doc) => (d.sections[0].title = "x".repeat(121)), "/sections/0/title too-long"],
  ])("reports %s", (_name, mutate, expected) => {
    const d = example()
    mutate(d)
    expect(codes(d)).toContain(expected)
  })

  it("is deterministic and reports every issue", () => {
    const d = example()
    d.schema = "x"
    delete d.sections[0].title
    expect(validatePage(d)).toEqual(validatePage(structuredClone(d)))
    expect(issues(d).length).toBe(2)
  })

  it("rejects non-objects", () => {
    expect(codes(null)).toEqual([" not-object"])
    expect(codes([])).toEqual([" not-object"])
  })

  it("resolves library references into full items", () => {
    const r = validatePage(example())
    if (!r.ok) throw new Error("invalid")
    const work = resolveRefs(r.page).sections[1]
    expect(work.block === "work" && work.items[0]).toEqual({ id: "acceptto", title: "Acceptto", summary: expect.any(String), year: "2025", role: "Design lead" })
  })
})

describe("schema/feather.page-0.json", () => {
  it("is generated from the spec (run `pnpm --filter @aleeforoughi/feather-page generate`)", () => {
    const file = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../schema/feather.page-0.json"), "utf8"))
    expect(file).toEqual(pageJsonSchema())
  })
  it("offers one schema per block", () => {
    const blocks = (pageJsonSchema().$defs as { block: { oneOf: { properties: { block: { const: string } } }[] } }).block.oneOf
    expect(blocks.map((b) => b.properties.block.const)).toEqual(BLOCK_NAMES)
  })
})
