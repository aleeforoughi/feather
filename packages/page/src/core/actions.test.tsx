// One filled action per section (Qooler file 28 section 3: on the winners about a quarter of actions are filled, so the
// one filled action stands out). A section's primary action may be filled; the rest are quiet. A /1 document that asks
// for two primaries in one section is a contradiction; /0 documents never carry the field.
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FeatherPage } from "../render"
import { FLOW_BLOCKS } from "../blocks/fixtures"
import { validatePage } from "./validate"
import { DISCLOSURE_RULE, defaultDisclosure, pageDisclosure } from "./disclosure"
import type { PageDocument } from "./types"

const doc = (sections: unknown[], schema = "feather.page/1") => ({ schema, brand: "brand.json", sections })
const hero = (actions: unknown[], extra: Record<string, unknown> = {}) => ({ block: "hero", title: "A title", actions, ...extra })
const contact = (actions: unknown[]) => ({ block: "contact", title: "Contact", actions })
const A = (label: string, primary?: boolean) => ({ label, href: `#${label.toLowerCase()}`, ...(primary === undefined ? {} : { primary }) })

function render(sections: unknown[]): Document {
  const r = validatePage(doc(sections))
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}`).join("\n"))
  const html = renderToStaticMarkup(<FeatherPage page={r.page as PageDocument} />)
  return new DOMParser().parseFromString(html, "text/html")
}
const filled = (d: Document, slot: string) => [...d.querySelectorAll(`[data-slot="${slot}"]`)].map((a) => `${a.textContent}:${a.getAttribute("data-variant")}`)

describe("one filled action per section", () => {
  it("fills the first action by default, and the rest are quiet (hero and contact)", () => {
    const d = render([hero([A("Start"), A("Read")]), contact([A("Write"), A("Call"), A("Visit")])])
    expect(filled(d, "hero-action")).toEqual(["Start:primary", "Read:quiet"])
    expect(filled(d, "contact-action")).toEqual(["Write:primary", "Call:quiet", "Visit:quiet"])
  })

  it("fills the action marked primary instead, or none when every one says primary: false", () => {
    const d = render([hero([A("Read"), A("Start", true)]), contact([A("Write", false), A("Call", false)])])
    expect(filled(d, "hero-action")).toEqual(["Read:quiet", "Start:primary"])
    expect(filled(d, "contact-action")).toEqual(["Write:quiet", "Call:quiet"])
  })

  it("a hero's starters lead only where they show (a Living Page); without one, its action is the filled one", () => {
    const d = render([hero([A("Read")], { starters: ["Show me"] })])
    expect(d.querySelector('[data-slot="hero-starter"]')).toBeNull()
    expect(filled(d, "hero-action")).toEqual(["Read:primary"])
  })

  it("two primaries in one section are a contradiction in /1", () => {
    for (const block of [hero([A("Start", true), A("Read", true)]), contact([A("Write", true), A("Call", true)])]) {
      const r = validatePage(doc([block]))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.issues).toEqual([expect.objectContaining({ path: "/sections/0/actions", code: "contradiction" })])
    }
  })

  it("is never a contradiction in /0: a /0 contact has no primary field at all", () => {
    expect(validatePage(doc([contact([A("Write"), A("Call")])], "feather.page/0")).ok).toBe(true)
    const r = validatePage(doc([contact([A("Write", true), A("Call", true)])], "feather.page/0"))
    expect(r.ok).toBe(false)
    if (!r.ok) for (const i of r.issues) expect(i.code).not.toBe("contradiction")
  })

  it("a podcast fills the first episode's Play only", () => {
    const second = { ...FLOW_BLOCKS.podcast.episodes[0], id: "two", title: "Two" }
    const d = render([{ ...FLOW_BLOCKS.podcast, episodes: [FLOW_BLOCKS.podcast.episodes[0], second] }])
    expect([...d.querySelectorAll('[data-slot="podcast-play"]')].map((b) => b.getAttribute("data-variant"))).toEqual(["primary", "quiet"])
  })
})

describe("the default disclosure", () => {
  const living = { speaker: { kind: "person", name: "Mara Ellis" }, living: { anchor: "reader" } }
  it("a living page with a speaker and no disclosure says it is an AI agent speaking for the speaker", () => {
    expect(defaultDisclosure("Mara Ellis")).toBe("An AI agent speaking for Mara Ellis")
    expect(pageDisclosure({ ...living } as never)).toBe("An AI agent speaking for Mara Ellis")
    expect(pageDisclosure({ ...living, living: { disclosure: "An AI agent, in Mara's words" } } as never)).toBe("An AI agent, in Mara's words")
    expect(pageDisclosure({ speaker: living.speaker } as never)).toBeUndefined()
  })

  it("holds to the validator's own rule: written out as the page's disclosure, it validates", () => {
    expect(DISCLOSURE_RULE.test(defaultDisclosure("Mara Ellis"))).toBe(true)
    const r = validatePage({ ...doc([hero([A("Start")])]), ...living, living: { anchor: "reader", disclosure: defaultDisclosure("Mara Ellis") } })
    expect(r.ok).toBe(true)
    const bad = validatePage({ ...doc([hero([A("Start")])]), ...living, living: { anchor: "reader", disclosure: "Speaking for Mara Ellis" } })
    expect(bad.ok).toBe(false)
  })

  it("is what the rendered Living Page shows", () => {
    const r = validatePage({ ...doc([hero([A("Start")])]), ...living })
    if (!r.ok) throw new Error(r.issues.map((i) => i.code).join())
    const html = renderToStaticMarkup(<FeatherPage page={r.page as PageDocument} />)
    expect(html).toContain("An AI agent speaking for Mara Ellis")
  })
})
