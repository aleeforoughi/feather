import { createDialog } from "@aleeforoughi/feather-dialog"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { compose, REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import { describe, expect, it } from "vitest"
import { createVoiceDialog, runVoice, spokenToDigits, speechFor, type Speech, type VoiceEngine } from "../src/index.ts"
import { campaign, fixtures, plan } from "./helpers.ts"

const VISUAL = /\b(click|clicks|clicking|see|below|above|button|buttons|tap|taps|screen)\b/i
const said = (speech: Speech[]) => speech.map((s) => s.text).join(" ")
const exp = (nodes: unknown[]) => ({ ir: "feather.ir/1", experience: "x", nodes })
const GO = { experience: "approve_campaign", node: "go", act: "confirm" }

describe("speechFor", () => {
  it("numbers a long list of choices", () => {
    const p = plan(campaign())
    expect(said(speechFor(createDialog(p).turn, p))).toMatch(/Say one for .+, two for .+, three for /)
  })

  it("says up to three choices as words", () => {
    const p = plan(exp([{ id: "a", type: "Approval", intent: "approve budget", request: "Approve the budget" }]))
    const choices = speechFor(createDialog(p).turn, p).find((s) => s.kind === "choices")
    expect(choices).toMatchObject({ text: "Say approve, or reject.", lang: p.locale })
  })

  it("says a value turn's options by their labels, never their ids", () => {
    const p = plan(exp([{ id: "size", type: "Choice", intent: "pick size", prompt: "Which size?", options: [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }] }]))
    const d = createVoiceDialog(p)
    const out = d.hear(["1"])
    expect(d.turn.state).toBe("value")
    expect(out.speech.map((s) => s.kind)).toEqual(["question", "choices"])
    expect(out.speech[1]!.text).toBe("Say Small, or Medium.")
    d.hear(["second"])
    expect(d.turn.state).toBe("readback")
    expect(d.hear(["yes"]).replies).toEqual([{ experience: "x", node: "size", act: "choose", value: "m" }])
  })

  it("says the consequence in full before asking for the keyword", () => {
    const p = plan(campaign())
    const { speech } = createVoiceDialog(p).hear(["one"])
    const kinds = speech.map((s) => s.kind)
    expect(said(speech)).toContain("Spends AED 1,050")
    expect(kinds.indexOf("consequence")).toBeLessThan(kinds.lastIndexOf("question"))
    expect(speech.at(-1)).toMatchObject({ kind: "question", text: 'Say "confirm" to go ahead, or "cancel".' })
    expect(speech.every((s) => s.lang === p.locale)).toBe(true)
  })

  it("reads a value back", () => {
    const d = createVoiceDialog(plan(campaign()))
    d.hear([String(d.turn.choices.find((c) => c.node === "own")!.n)])
    const bad = d.hear(["a lot"])
    expect(d.turn.state).toBe("value")
    expect(bad.speech[0]!.kind).toBe("problem")
    const out = d.hear(["300 usd"])
    expect(d.turn.state).toBe("readback")
    expect(said(out.speech)).toMatch(/You said .*300.*\. Is that right\? Say yes or no\./)
  })
})

describe("the caller's words", () => {
  it("are said verbatim, never reworded for the ear", () => {
    const ir = { ir: "feather.ir/1", experience: "e", nodes: [{ type: "Text", id: "t", text: "See you tomorrow. Prices above 5 AED stay on screen." }] }
    const result = compose(ir, REFERENCE_CONTEXTS.screenless.context)
    if (!result.ok) throw new Error("does not compose")
    expect(said(speechFor(createVoiceDialog(result.plan).turn, result.plan))).toContain("See you tomorrow. Prices above 5 AED stay on screen.")
  })
})

describe("every valid fixture, screenless", () => {
  for (const { name, ir } of fixtures()) {
    it(`${name}: the first turn mentions every node, and nothing visual is ever said`, () => {
      const result = compose(ir, REFERENCE_CONTEXTS.screenless.context)
      if (!result.ok) throw new Error("does not compose")
      const p = result.plan
      const d = createVoiceDialog(p)
      const first = d.turn
      const spoken = said(speechFor(first, p))
      for (const id of p.order) {
        const parts = first.parts.filter((x) => x.node === id)
        const choices = first.choices.filter((c) => c.node === id)
        const ok = parts.some((x) => spoken.includes(x.text)) || choices.some((c) => spoken.includes(c.label.replace(/[.!?\s]+$/, "")))
        expect(ok, `${name}: node ${id} is not mentioned`).toBe(true)
      }
      // Every turn a conversation reaches by picking each act, then wrong, odd and global words.
      for (let i = 1; i <= first.choices.length; i++) {
        const walk = createVoiceDialog(p)
        const turns = [walk.turn]
        for (const input of [String(i), "help", "banana", "yes", "300", "repeat", "back", "1", "confirm"]) turns.push(walk.hear([input]) && walk.turn)
        for (const turn of turns) {
          const speech = speechFor(turn, p)
          // Feather's own words never assume a screen; the caller's words are said exactly as written.
          for (const s of speech) if (s.kind === "question" || s.kind === "hint" || s.kind === "problem") expect(s.text, `${name}: ${s.text}`).not.toMatch(VISUAL)
          for (const part of turn.parts) if (part.kind === "content" || part.kind === "consequence" || part.kind === "outcome") expect(speech.map((s) => s.text)).toContain(part.text)
        }
      }
    })
  }
})

describe("the ad-campaign-launch spend by voice", () => {
  const spend = (first: string) => {
    const d = createVoiceDialog(plan(campaign()))
    const replies: ReplyEvent[] = []
    const say = (...t: string[]) => replies.push(...d.hear(t).replies)
    say(first)
    expect(d.turn.state).toBe("confirm")
    say("yes")
    expect(replies).toEqual([])
    expect(d.turn.state).toBe("confirm")
    say("confirm")
    return replies
  }
  it('"one" arms it, "yes" does not commit, "confirm" commits exactly once', () => {
    expect(spend("one")).toEqual([GO])
  })
  it('"option one" does the same', () => {
    expect(spend("option one")).toEqual([GO])
  })
})

describe("alternatives", () => {
  const armed = () => {
    const d = createVoiceDialog(plan(campaign()))
    d.hear(["one"])
    return d
  }
  it("commits via the second alternative only", () => {
    expect(armed().hear(["confirm please", "confirm"]).replies).toEqual([GO])
  })
  it('"conform" commits nothing and keeps the first outcome', () => {
    const d = armed()
    const out = d.hear(["conform"])
    expect(out.replies).toEqual([])
    expect(d.turn.state).toBe("confirm")
    expect(out.speech.find((s) => s.kind === "problem")).toMatchObject({ text: "Nothing was done." })
  })
  it("a partial match never commits, in any alternative", () => {
    const d = armed()
    expect(d.hear(["confirm please", "please confirm", "confirmed"]).replies).toEqual([])
    expect(d.turn.state).toBe("confirm")
  })
  it("a rejected alternative never changes state", () => {
    const p = plan(campaign())
    const a = createVoiceDialog(p)
    const b = createVoiceDialog(p)
    a.hear(["nonsense", "99", "banana", "1"])
    b.hear(["1"])
    expect(a.turn).toEqual(b.turn)
    // A rejected "cancel"-like or committing-looking alternative leaves the armed act armed.
    const x = a.hear(["confirm please", "confirm now", "confirm"])
    const y = b.hear(["confirm"])
    expect(x.replies).toEqual(y.replies)
    expect(x.replies).toEqual([GO])
    expect(a.turn).toEqual(b.turn)
  })
  it("the first accepted alternative wins, even over a later one that would do more", () => {
    const d = createVoiceDialog(plan(campaign()))
    expect(d.hear(["help", "1"]).replies).toEqual([])
    expect(d.turn.state).toBe("browse")
  })
  it("an empty list is a silence the dialog answers", () => {
    const d = createVoiceDialog(plan(campaign()))
    expect(d.hear([]).speech[0]!.kind).toBe("problem")
  })
})

describe("spoken numbers", () => {
  it("maps a whole utterance and option/number N, nothing inside a longer answer", () => {
    expect(spokenToDigits("Two", "en")).toBe("2")
    expect(spokenToDigits("zero", "en")).toBe("0")
    expect(spokenToDigits("twenty.", "en")).toBe("20")
    expect(spokenToDigits("first", "en")).toBe("1")
    expect(spokenToDigits("tenth", "en")).toBe("10")
    expect(spokenToDigits("option two", "en")).toBe("2")
    expect(spokenToDigits("number three", "en")).toBe("3")
    expect(spokenToDigits("two adults and a child", "en")).toBe("two adults and a child")
    expect(spokenToDigits("option two please", "en")).toBe("option two please")
  })
  it("leaves free text alone in a text value turn", () => {
    const p = plan(exp([{ id: "t", type: "Text", text: "Name." }, { id: "c", type: "Correction", intent: "fix name", target: "t", prompt: "What is the right name?", original: "x" }]))
    const d = createVoiceDialog(p, { readback: false })
    d.hear(["1"])
    expect(d.turn.state).toBe("value")
    expect(d.hear(["two"]).replies[0]).toMatchObject({ node: "c", value: "two" })
  })
  it("maps a lone number word in a number value turn", () => {
    const p = plan(exp([{ id: "n", type: "Input", intent: "give guests", kind: "number", prompt: "How many guests?" }]))
    const d = createVoiceDialog(p)
    d.hear(["1"])
    d.hear(["five"])
    expect(d.turn.state).toBe("readback")
    expect(d.turn.parts.map((x) => x.text).join(" ")).toContain("5")
    expect(d.hear(["yeah"]).replies).toEqual([{ experience: "x", node: "n", act: "submit", value: 5 }])
  })
})

describe("readback of a money value", () => {
  it("no asks again, yes sends it", () => {
    const p = plan(campaign())
    const d = createVoiceDialog(p)
    d.hear([String(d.turn.choices.find((c) => c.node === "own")!.n)])
    const first = d.hear(["300 usd"])
    expect(d.turn.state).toBe("readback")
    expect(first.replies).toEqual([])
    const no = d.hear(["nope"])
    expect(no.replies).toEqual([])
    expect(d.turn.state).toBe("value")
    d.hear(["450 aed"])
    expect(d.turn.state).toBe("readback")
    expect(said(speechFor(d.turn, p))).toContain("450")
    expect(d.hear(["yes"]).replies).toEqual([{ experience: "approve_campaign", node: "own", act: "choose", value: { amount: 450, currency: "AED" } }])
  })
  it("yeah and correct are yes", () => {
    const p = plan(campaign())
    for (const word of ["yeah", "correct"]) {
      const d = createVoiceDialog(p)
      d.hear([String(d.turn.choices.find((c) => c.node === "own")!.n)])
      d.hear(["300 usd"])
      expect(d.hear([word]).replies).toHaveLength(1)
    }
  })
})

describe("runVoice", () => {
  const engine = (script: string[][]) => {
    const spoken: Speech[][] = []
    const e: VoiceEngine = { speak: async (s) => void spoken.push(s), listen: async () => script.shift() ?? [] }
    return { e, spoken }
  }
  it("runs the campaign end to end", async () => {
    const p = plan(campaign())
    const ahead = createVoiceDialog(p)
    ahead.hear(["1"])
    ahead.hear(["confirm"]) // "go" is answered, so the numbers shift
    const own = ahead.turn.choices.find((c) => c.node === "own")!.n
    const { e, spoken } = engine([["uh"], ["option one"], ["yes"], ["confirm please", "confirm"], [String(own)], ["300 usd"], ["yeah"]])
    const replies: ReplyEvent[] = []
    const result = await runVoice(p, e, (r) => void replies.push(r))
    expect(replies).toEqual([GO, { experience: "approve_campaign", node: "own", act: "choose", value: { amount: 300, currency: "USD" } }])
    expect(result.replies).toEqual(replies)
    expect(result.silent).toBe(true) // the script ran out; "rec" and "less" were never answered
    expect(spoken[0]!.length).toBeGreaterThan(3)
    expect(spoken.flat().filter((s) => s.kind === "question" || s.kind === "hint" || s.kind === "problem").every((s) => !VISUAL.test(s.text))).toBe(true)
  })
  it("stops after three silences in a row, and says so", async () => {
    const { e, spoken } = engine([["x"], [], [], [""]])
    const result = await runVoice(plan(campaign()), e, () => undefined)
    expect(result).toMatchObject({ done: false, silent: true })
    expect(spoken.at(-1)![0]!.text).toMatch(/stopping/)
  })
  it("a heard word resets the count", async () => {
    let calls = 0
    const script = [[], [], ["help"], [], [], ["help"], [], [], []]
    const e: VoiceEngine = { speak: async () => undefined, listen: async () => (calls++, script.shift() ?? []) }
    await runVoice(plan(campaign()), e, () => undefined)
    expect(calls).toBe(9)
  })
  it("finishes at once when nothing is left to act on", async () => {
    const p = plan(exp([{ id: "t", type: "Text", text: "Hello" }]))
    const { e, spoken } = engine([])
    expect(await runVoice(p, e, () => undefined)).toMatchObject({ done: true, silent: false })
    expect(spoken).toHaveLength(1)
  })
})
