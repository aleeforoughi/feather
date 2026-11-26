// The product flows validate (wave 5): every block and knob is accepted as the fixtures write it, a flow block on a /0
// page names the schema it needs, and every contradiction the field tables cannot see has its pointer and code.
import { describe, expect, it } from "vitest"
import { FLOW_BLOCKS } from "../blocks/fixtures"
import { validatePage } from "./validate"

const hero = { block: "hero", title: "Hello" }
const page = (sections: unknown[], extra: Record<string, unknown> = {}) => ({ schema: "feather.page/1", brand: "b.json", sections: [hero, ...sections], ...extra })
const codes = (doc: unknown) => {
  const r = validatePage(doc)
  return r.ok ? [] : r.issues.map((i) => `${i.path} ${i.code}`)
}
const one = (block: object, extra?: Record<string, unknown>) => codes(page([block], extra))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe("the flow blocks validate", () => {
  it.each(Object.keys(FLOW_BLOCKS))("accepts the %s fixture", (kind) => {
    expect(one(FLOW_BLOCKS[kind as keyof typeof FLOW_BLOCKS])).toEqual([])
  })

  it("are blocks of feather.page/1", () => {
    expect(codes({ schema: "feather.page/0", brand: "b.json", sections: [hero, FLOW_BLOCKS.quiz] })).toEqual(["/sections/1/block needs-schema-1"])
  })
})

describe("quiz", () => {
  const quiz = () => clone(FLOW_BLOCKS.quiz) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it("tally: every answer points to a real result, and takes no score", () => {
    const q = quiz()
    q.questions[0].options[0].result = "nowhere"
    delete q.questions[0].options[1].result
    q.questions[1].options[0].score = 2
    expect(one(q)).toEqual(["/sections/1/questions/0/options/0/result unknown-ref", "/sections/1/questions/0/options/1/result missing", "/sections/1/questions/1/options/0/score contradiction"])
  })

  it("ids are slugs and unique", () => {
    const q = quiz()
    q.questions[1].id = q.questions[0].id
    q.questions[2].options[1].id = "Not A Slug"
    expect(one(q)).toEqual(["/sections/1/questions/1/id duplicate-id", "/sections/1/questions/2/options/1/id type"])
  })

  it("a match names real questions and answers", () => {
    const q = quiz()
    q.results[0].match = { stage: "idea", nope: "x", team: "nobody" }
    expect(one(q)).toEqual(["/sections/1/results/0/match/nope unknown-ref", "/sections/1/results/0/match/team unknown-ref"])
  })

  const scored = () => ({
    block: "quiz",
    title: "Q",
    scoring: "score",
    questions: [
      { id: "a", q: "A?", options: [{ id: "lo", label: "Lo", score: 0 }, { id: "hi", label: "Hi", score: 2 }] },
      { id: "b", q: "B?", options: [{ id: "lo", label: "Lo", score: 0 }, { id: "hi", label: "Hi", score: 2 }] },
    ],
    results: [
      { id: "calm", title: "Calm", min: 0, max: 1 },
      { id: "loud", title: "Loud", min: 2 },
    ],
  })

  it("score: every answer scores, every result has a range, and every reachable total has a result", () => {
    expect(one(scored())).toEqual([])
    const s = scored()
    s.results[1].min = 3
    expect(one(s)).toEqual(["/sections/1/results contradiction"])
    const t = scored() as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    delete t.questions[0].options[0].score
    t.questions[0].options[1].result = "calm"
    t.results[0] = { id: "calm", title: "Calm", min: 4, max: 1 }
    expect(one(t)).toEqual(["/sections/1/questions/0/options/0/score missing", "/sections/1/questions/0/options/1/result contradiction", "/sections/1/results/0/max out-of-range"])
  })

  it("names the totals no result covers", () => {
    const s = scored()
    s.results[1].min = 3
    const r = validatePage(page([s]))
    expect(!r.ok && r.issues[0].message).toBe("no result covers the total 2 (the answers reach 0 to 4)")
  })

  it("min and max are a scored quiz's", () => {
    const q = quiz()
    q.results[0].min = 1
    expect(one(q)).toEqual(["/sections/1/results/0/min contradiction"])
  })
})

describe("booking", () => {
  const booking = () => clone(FLOW_BLOCKS.booking) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it("sends to exactly one place", () => {
    const none = booking()
    delete none.mailto
    expect(one(none)).toEqual(["/sections/1/action missing"])
    expect(one({ ...booking(), action: "/book" })).toEqual(["/sections/1/mailto contradiction"])
    const link = booking()
    delete link.mailto
    expect(one({ ...link, link: "https://cal.example.com/alee" })).toEqual([])
    expect(one({ ...link, link: "http://cal.example.com/alee" })).toEqual(["/sections/1/link bad-href"])
    expect(one({ ...link, action: "mailto:hello@example.com" })).toEqual(["/sections/1/action bad-href"])
    expect(one({ ...link, mailto: "not an address" })).toEqual(["/sections/1/mailto type"])
  })

  it("dates are real and listed once, slots are times of day and listed once a day", () => {
    const b = booking()
    b.days[0].date = "2026-02-30"
    b.days[2].date = b.days[1].date
    b.days[1].slots.push("10:00", "25:00")
    expect(one(b)).toEqual(["/sections/1/days/0/date type", "/sections/1/days/1/slots/2 duplicate-id", "/sections/1/days/1/slots/3 type", "/sections/1/days/2/date duplicate-id"])
  })

  it("bounds the lists", () => {
    const b = booking()
    b.days = Array.from({ length: 15 }, (_, i) => ({ date: `2026-12-${String(i + 1).padStart(2, "0")}`, slots: ["09:00"] }))
    expect(one(b)).toEqual(["/sections/1/days too-many"])
  })
})

describe("calculator", () => {
  const calc = () => clone(FLOW_BLOCKS.calculator) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it("refuses a formula that does not parse, with where", () => {
    const c = calc()
    c.formula = "design + * build"
    const r = validatePage(page([c]))
    expect(!r.ok && r.issues.map((i) => `${i.path} ${i.code} ${i.message}`)).toEqual(['/sections/1/formula bad-formula unexpected "*" (at character 10)'])
  })

  it("refuses a formula that reads a name that is not an input or an earlier line", () => {
    const c = calc()
    c.lines[0].formula = "pages * 400 + build"
    c.formula = "design + tax"
    expect(one(c)).toEqual(["/sections/1/lines/0/formula unknown-ref", "/sections/1/formula unknown-ref"])
  })

  it("refuses a formula with no value at the starting choices or at an input's bounds", () => {
    const c = calc()
    c.formula = "design / (pages - 5)"
    expect(one(c)).toEqual(["/sections/1/formula contradiction"])
    const d = calc()
    d.formula = "design / (20 - pages)"
    const r = validatePage(page([d]))
    expect(!r.ok && r.issues[0].message).toBe("the formula has no value when pages is 20 (a division by zero?)")
  })

  it("input names are formula names, unique, and not a function's", () => {
    const c = calc()
    c.inputs[0].id = "Pages"
    c.inputs[1].id = "round"
    c.lines[1].id = "design"
    expect(one(c)).toEqual(expect.arrayContaining(["/sections/1/inputs/0/id type", "/sections/1/inputs/1/id type", "/sections/1/lines/1/id duplicate-id"]))
  })

  it("each kind takes its own fields, inside its bounds", () => {
    const c = calc()
    c.inputs[0] = { id: "pages", label: "Pages", kind: "range", min: 10, max: 5, value: 3 }
    c.inputs[1] = { id: "system", label: "System", kind: "radio", min: 1, value: 7, options: [{ label: "A", value: 0 }, { label: "B", value: 1 }] }
    c.inputs[2] = { id: "copy", label: "Copy", kind: "toggle", value: 2, options: [{ label: "A", value: 0 }, { label: "B", value: 1 }] }
    expect(one(c)).toEqual(["/sections/1/inputs/0/max out-of-range", "/sections/1/inputs/1/min unsupported", "/sections/1/inputs/1/value contradiction", "/sections/1/inputs/2/options unsupported", "/sections/1/inputs/2/value out-of-range"])
    const n = calc()
    n.inputs[0] = { id: "pages", label: "Pages", kind: "number" }
    expect(one(n)).toEqual(["/sections/1/inputs/0/min missing", "/sections/1/inputs/0/max missing"])
  })
})

describe("chart, places, podcast", () => {
  it("chart: one value per series in every row", () => {
    const c = clone(FLOW_BLOCKS.chart) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    c.rows[1].values = [1, 2]
    c.rows[2].values = ["a"]
    expect(one(c)).toEqual(["/sections/1/rows/2/values type", "/sections/1/rows/1/values contradiction"])
    expect(one({ ...clone(FLOW_BLOCKS.chart), summary: undefined })).toEqual(["/sections/1/summary missing"])
    expect(one({ ...clone(FLOW_BLOCKS.chart), variant: "pie" })).toEqual(["/sections/1/variant unknown-variant"])
  })

  it("places: the map variant is built on its still", () => {
    expect(one({ ...clone(FLOW_BLOCKS.places), variant: "map" })).toEqual(["/sections/1/media missing"])
  })

  it("podcast: audio is an audio file, the transcript is required, and both lists run in order", () => {
    const p = clone(FLOW_BLOCKS.podcast) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    p.episodes[0].audio = "episode.jpg"
    p.episodes[0].chapters = [{ at: 10, title: "B" }, { at: 5, title: "A" }]
    p.episodes[0].transcript = [{ at: 4, text: "b" }, { at: 1, text: "a" }]
    expect(one(p)).toEqual(["/sections/1/episodes/0/audio bad-media", "/sections/1/episodes/0/chapters/1/at contradiction", "/sections/1/episodes/0/transcript/1/at contradiction"])
    const q = clone(FLOW_BLOCKS.podcast) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    delete q.episodes[0].transcript
    expect(one(q)).toEqual(["/sections/1/episodes/0/transcript missing"])
  })
})

describe("the knobs: views and scheme", () => {
  const work = { block: "work", items: [{ id: "a", title: "A" }] }

  it("views: one of grid, list and index, on a grid", () => {
    expect(one({ ...work, views: "list" })).toEqual([])
    expect(one({ ...work, views: "cards" })).toEqual(["/sections/1/views type"])
    expect(one({ ...work, views: "grid", variant: "rail" })).toEqual(["/sections/1/views contradiction"])
    expect(one({ ...work, views: "grid", loudness: 2, scroll: { pattern: "stack" } })).toEqual(["/sections/1/views contradiction"])
    expect(one({ block: "faq", items: [{ q: "Q", a: "A" }], views: "list" })).toEqual(["/sections/1/views unknown-field"])
  })

  const colors = { background: "#100904", surface: "#1C130C", text: "#FFEDD7", primary: "#FF8539", primaryText: "#100904" }
  const nav = { items: [{ label: "Work", href: "#work" }] }

  it("scheme: the other set's colours, read at 4.5:1, with an edge to sit in", () => {
    expect(codes(page([], { nav, scheme: { colors } }))).toEqual([])
    expect(codes(page([], { footer: {}, scheme: { colors, toggle: "footer" } }))).toEqual([])
    expect(codes(page([], { scheme: { colors } }))).toEqual(["/scheme missing"])
    expect(codes(page([], { footer: {}, scheme: { colors, toggle: "nav" } }))).toEqual(["/scheme/toggle missing"])
    expect(codes(page([], { nav, scheme: { colors: { ...colors, text: "#3a2a20" } } }))).toEqual(["/scheme/colors/text contradiction", "/scheme/colors/text contradiction"])
    expect(codes(page([], { nav, scheme: { colors: { ...colors, accent: "orange" } } }))).toEqual(["/scheme/colors/accent type"])
    expect(codes(page([], { nav, scheme: { toggle: "nav" } }))).toEqual(["/scheme/colors missing"])
    expect(codes({ schema: "feather.page/0", brand: "b.json", sections: [hero], scheme: { colors } })).toEqual(["/scheme needs-schema-1"])
  })
})
