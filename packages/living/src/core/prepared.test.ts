import { describe, expect, it } from "vitest"
import { checkPrepared, matchPrepared, preparedEvents, preparedRoutes, type PreparedScene } from "./prepared"

const work: PreparedScene = { intent: "work", ask: "Show me the work", line: "Here is what I made.", blocks: [{ block: "work", title: "Selected work" }], asks: ["Who are you?"] }
const about: PreparedScene = { intent: "about-me", ask: "Who are you?", line: "I design.", blocks: [{ block: "statement" }] }

describe("checkPrepared", () => {
  it("accepts good scenes", () => expect(checkPrepared([work, about])).toEqual([]))
  it("reports bad slugs, duplicates, empty lines and block counts", () => {
    const bad = [{ ...work, intent: "Work!" }, { ...work }, { ...about, intent: "work", line: " ", blocks: [] }]
    const p = checkPrepared(bad)
    expect(p.some((x) => x.includes("route slug"))).toBe(true)
    expect(p.some((x) => x.includes("twice"))).toBe(true)
    expect(p.some((x) => x.includes("spoken line"))).toBe(true)
    expect(p.some((x) => x.includes("0 blocks"))).toBe(true)
  })
})

describe("matchPrepared", () => {
  it("matches an intent or ask ignoring case and punctuation", () => {
    expect(matchPrepared([work, about], "show me the WORK!")).toBe(work)
    expect(matchPrepared([work, about], "about me")).toBe(about)
    expect(matchPrepared([work, about], "something else")).toBeNull()
  })
})

describe("preparedEvents", () => {
  it("is the stream a live answer would send, ending in done", () => {
    const e = preparedEvents(work)
    expect(e.filter((x) => x.type === "word").map((x) => (x as { text: string }).text).join("")).toBe(work.line)
    expect(e.map((x) => x.type).slice(-3)).toEqual(["block", "asks", "done"])
    expect(preparedEvents(about).map((x) => x.type)).not.toContain("asks")
  })
})

describe("preparedRoutes", () => {
  it("builds one route per scene under a base", () => {
    expect(preparedRoutes([work, about])).toEqual([
      { path: "/work", intent: "work", title: "Selected work" },
      { path: "/about-me", intent: "about-me", title: "Who are you?" },
    ])
    expect(preparedRoutes([work], "/me")[0].path).toBe("/me/work")
  })
})
