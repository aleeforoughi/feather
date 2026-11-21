import { describe, expect, it } from "vitest"
import { FOLLOW_SLACK, anchorScroll, atBottom, followDecision, sectionInView } from "./placement"

const sections = [
  { id: "hero", top: -800, bottom: 100 },
  { id: "work", top: 100, bottom: 900 },
  { id: "story", top: 900, bottom: 1700 },
]
const vp = { top: 0, height: 1000 }

describe("sectionInView", () => {
  it("is null with nothing measured", () => expect(sectionInView([], vp)).toBeNull())
  it("picks the section holding the reading line", () => expect(sectionInView(sections, vp)).toBe("work"))
  it("falls back to the most visible section", () => {
    expect(sectionInView([{ id: "a", top: 0, bottom: 100 }, { id: "b", top: 500, bottom: 700 }], { top: 0, height: 1000 })).toBe("b")
  })
  it("falls back to the last section above, or the first", () => {
    expect(sectionInView([{ id: "a", top: -500, bottom: -100 }, { id: "b", top: -90, bottom: -10 }], vp)).toBe("b")
    expect(sectionInView([{ id: "a", top: 2000, bottom: 2100 }], vp)).toBe("a")
  })
})

describe("atBottom and followDecision", () => {
  it("is at the bottom within the slack", () => {
    expect(atBottom({ scrollTop: 0, viewportHeight: 1000, contentBottom: 1000 + FOLLOW_SLACK })).toBe(true)
    expect(atBottom({ scrollTop: 0, viewportHeight: 1000, contentBottom: 1000 + FOLLOW_SLACK + 1 })).toBe(false)
  })
  it("follows only a growing answer the reader is at the bottom of", () => {
    const here = { scrollTop: 0, viewportHeight: 1000, contentBottom: 1000 }
    const away = { scrollTop: 0, viewportHeight: 1000, contentBottom: 3000 }
    expect(followDecision(here, true)).toEqual({ follow: true, showJump: false })
    expect(followDecision(here, false)).toEqual({ follow: false, showJump: false })
    expect(followDecision(away, true)).toEqual({ follow: false, showJump: true })
  })
})

describe("anchorScroll", () => {
  it("puts the turn at the top below an offset, never negative", () => {
    expect(anchorScroll(1200)).toBe(1200)
    expect(anchorScroll(1200.4, 80)).toBe(1120)
    expect(anchorScroll(20, 80)).toBe(0)
  })
})
