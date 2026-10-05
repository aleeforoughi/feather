import { describe, expect, it } from "vitest"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import { createVoiceDialog, runVoice, spokenAnswer, speechFor, type Speech, type VoiceEngine } from "../src/index.ts"
import { fixtureFile, plan } from "./helpers.ts"
import fs from "node:fs"

const load = (name: string) => JSON.parse(fs.readFileSync(fixtureFile(name), "utf8")).ir
const said = (speech: Speech[]) => speech.map((s) => s.text).join(" ")
const form = () => ({
    ir: "feather.ir/1",
    experience: "event",
    nodes: [
      {
        type: "Form",
        id: "f",
        intent: "tell us about the event",
        submitLabel: "Send the details",
        fields: [
          { id: "name", prompt: "Event name", kind: "text", required: true },
          { id: "guests", prompt: "How many guests", kind: "number", min: 2, max: 99 },
          { id: "budget", prompt: "Budget", kind: "money", currency: "AED", min: 5 },
          { id: "mail", prompt: "Contact email", kind: "email" },
          { id: "tel", prompt: "Contact phone", kind: "phone" },
          { id: "site", prompt: "Website", kind: "url" },
        ],
      },
    ],
  })

function hear(d: ReturnType<typeof createVoiceDialog>, ...phrases: Array<string | string[]>) {
  const replies: ReplyEvent[] = []
  for (const p of phrases) replies.push(...d.hear(Array.isArray(p) ? p : [p]).replies)
  return replies
}

describe("a Form by voice", () => {
  it("asks the poster form one question at a time, with the prompt, the count and the groups spoken", () => {
    const p = plan(load("poster-details-form.json"))
    const d = createVoiceDialog(p)
    const out = d.hear(["option one"])
    expect(d.turn.state).toBe("value")
    expect(out.replies).toEqual([])
    expect(said(out.speech)).toBe('Details for the farmers market poster 5 questions. Schedule: Question 1 of 5: Market time. Say "skip" to leave it out or "skip all" to skip the whole form.')
    expect(out.speech.every((s) => s.lang === p.locale)).toBe(true)
  })

  it("does not read each answer back as it goes, and reads them all back once at the end", () => {
    const d = createVoiceDialog(plan(load("poster-details-form.json")))
    hear(d, "one", "nine to two", "2026-03-07")
    expect(d.turn.state).toBe("value")
    hear(d, "skip", "twenty five", "skip")
    expect(d.turn.state).toBe("review")
    const speech = speechFor(d.turn, plan(load("poster-details-form.json")))
    expect(said(speech)).toContain('1. Market time: "nine to two".')
    expect(said(speech)).toContain("4. Stall fee: AED 25.")
    expect(speech.at(-1)).toMatchObject({ kind: "question" })
    expect(speech.at(-1)!.text).toMatch(/^Say "send" to run again with my answers, or "change" and a number from 1 to 5/)
  })

  it("sends one submit reply with only what was answered, when the person says send", () => {
    const d = createVoiceDialog(plan(load("shipping-address-form.json")))
    const replies = hear(d, "one", "Sam Rivera", "1 marina walk", "Dubai", "skip")
    expect(replies).toEqual([])
    expect(hear(d, "send")).toEqual([{ experience: "shipping_address", node: "address", act: "submit", value: { name: "Sam Rivera", street: "1 marina walk", city: "Dubai" } }])
  })

  it("sends nothing for anything but the send word, and maps 'change two' and 'yeah' as the dialog takes them", () => {
    const d = createVoiceDialog(plan(form()))
    hear(d, "one", "Spring fair", "skip", "skip", "skip", "skip", "skip")
    expect(d.turn.state).toBe("review")
    for (const phrase of ["okay", "go ahead", "change", "seven"]) expect(hear(d, phrase)).toEqual([])
    expect(d.turn.state).toBe("review")
    hear(d, "change one")
    expect(d.turn.state).toBe("value")
    expect(d.turn.parts.find((p) => p.kind === "question")!.text).toMatch(/^Change question 1/)
    hear(d, "Autumn fair")
    expect(hear(d, "yeah")).toHaveLength(1)
  })

  it("changes one answer by saying its number as a word, or its name", () => {
    for (const phrase of ["change two", "two", "change number two", "change how many guests"]) {
      const d = createVoiceDialog(plan(form()))
      hear(d, "one", "Spring fair", "twenty five", "skip", "skip", "skip", "skip")
      hear(d, phrase)
      expect(d.turn.state, phrase).toBe("value")
      expect(d.turn.parts.find((p) => p.kind === "question")!.text, phrase).toMatch(/^Change question 2: How many guests/)
    }
  })

  it("hears numbers, money, phone, email and web addresses in the way they are spoken, and text as it is", () => {
    const d = createVoiceDialog(plan(form()))
    const replies = hear(d, "one", "two hundred", "Sixty", "twenty five", "sam at example dot com", "plus nine seven one five oh one two three four five six", "https colon slash slash example dot com")
    expect(replies).toEqual([])
    expect(d.turn.state).toBe("review")
    // The first answer was the event name, so "two hundred" is the name; the rest follow the kinds.
    expect(hear(d, "send")).toEqual([
      {
        experience: "event",
        node: "f",
        act: "submit",
        value: { name: "two hundred", guests: 60, budget: 25, mail: "sam@example.com", tel: "+97150123456", site: "https://example.com" },
      },
    ])
  })

  it("takes the engine's next alternative when the first does not fit", () => {
    const d = createVoiceDialog(plan(form()))
    hear(d, "one", "Spring fair")
    // The first alternative is not a number; the second is.
    const out = d.hear(["too many", "forty two"])
    expect(out.speech.some((s) => s.kind === "problem")).toBe(false)
    expect(d.turn.parts.find((p) => p.kind === "question")!.text).toMatch(/^Question 3 of 6: Budget/)
  })

  it("says why a bad required answer is not taken, and asks again", () => {
    const d = createVoiceDialog(plan(load("shipping-address-form.json")))
    hear(d, "one")
    const out = d.hear(["skip"])
    expect(said(out.speech)).toBe('This one is required, so it cannot be skipped. Question 1 of 4, required: Full name')
    expect(out.replies).toEqual([])
  })

  it("skips the whole poster form with one skip reply, by choice or by 'skip all'", () => {
    expect(hear(createVoiceDialog(plan(load("poster-details-form.json"))), "two")).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
    expect(hear(createVoiceDialog(plan(load("poster-details-form.json"))), "one", "skip all")).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
  })

  it("uses no words that need a screen or a keyboard in what it says itself", () => {
    const p = plan(load("poster-details-form.json"))
    const d = createVoiceDialog(p)
    const all: Speech[] = [...speechFor(d.turn, p)]
    for (const phrase of ["one", "skip", "2026-03-07", "skip", "skip", "skip", "nonsense"]) all.push(...d.hear([phrase]).speech)
    expect(said(all)).not.toMatch(/\b(click|see|below|above|button|tap|screen|type)\b/i)
  })

  it("runs a whole conversation through an engine and sends one reply", async () => {
    const lines = ["one", "Sam Rivera", "1 Marina Walk", "Dubai", "skip", "send"]
    const heard: string[][] = lines.map((l) => [l])
    const spoken: Speech[][] = []
    const engine: VoiceEngine = { speak: async (s) => void spoken.push(s), listen: async () => heard.shift() ?? [] }
    const replies: ReplyEvent[] = []
    const result = await runVoice(plan(load("shipping-address-form.json")), engine, (r) => void replies.push(r))
    expect(result.done).toBe(true)
    expect(replies).toHaveLength(1)
    expect(replies[0]).toMatchObject({ act: "submit", value: { name: "Sam Rivera", city: "Dubai" } })
  })
})

describe("spokenAnswer", () => {
  it("maps spoken numbers", () => {
    expect(spokenAnswer("twenty five", "number", "en")).toBe("25")
    expect(spokenAnswer("one hundred and four", "money", "en")).toBe("104")
    expect(spokenAnswer("forty", "number", "en")).toBe("40")
    expect(spokenAnswer("two point five", "money", "en")).toBe("2.5")
    expect(spokenAnswer("a lot", "number", "en")).toBeUndefined()
    expect(spokenAnswer("one one", "number", "en")).toBeUndefined()
  })
  it("maps phones, emails and addresses, and leaves text and dates alone", () => {
    expect(spokenAnswer("plus nine seven one five oh one two three", "phone", "en")).toBe("+97150123")
    expect(spokenAnswer("call me", "phone", "en")).toBeUndefined()
    expect(spokenAnswer("sam underscore rivera at example dot com", "email", "en")).toBe("sam_rivera@example.com")
    expect(spokenAnswer("sam", "email", "en")).toBeUndefined()
    expect(spokenAnswer("https colon slash slash example dot com", "url", "en")).toBe("https://example.com")
    expect(spokenAnswer("two", "text", "en")).toBeUndefined()
    expect(spokenAnswer("two", "date", "en")).toBeUndefined()
  })
})
