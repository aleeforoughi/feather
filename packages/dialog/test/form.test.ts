import { describe, expect, it } from "vitest"
import type { ReplyEvent } from "@aleeforoughi/feather-intent"
import type { Turn } from "../src/index.ts"
import { dialogOf, experience, fixture, numberOf, texts, WEB } from "./helpers.ts"

const poster = () => fixture("poster-details-form.json")
const shipping = () => fixture("shipping-address-form.json")

/** Says each line in turn and returns every reply that went out, in order. */
function say(d: ReturnType<typeof dialogOf>, ...lines: string[]): ReplyEvent[] {
  const out: ReplyEvent[] = []
  for (const line of lines) out.push(...d.answer(line).replies)
  return out
}
const question = (turn: Turn) => texts(turn, "question").join(" ")
const problem = (turn: Turn) => texts(turn, "problem").join(" ")

/** A form with one field of every kind, for the sequence of each kind. */
const kinds = () =>
  experience([
    {
      type: "Form",
      id: "f",
      intent: "tell us about the event",
      prompt: "About the event",
      submitLabel: "Send the details",
      fields: [
        { id: "name", prompt: "Event name", kind: "text", required: true, maxLength: 20 },
        { id: "about", prompt: "Tell us more", kind: "long-text" },
        { id: "guests", prompt: "How many guests", kind: "number", min: 2, max: 9, group: "Numbers" },
        { id: "budget", prompt: "Budget", kind: "money", currency: "AED", min: 5, group: "Numbers" },
        { id: "day", prompt: "Which day", kind: "date" },
        { id: "mail", prompt: "Contact email", kind: "email", group: "Contact" },
        { id: "tel", prompt: "Contact phone", kind: "phone", group: "Contact" },
        { id: "site", prompt: "Website", kind: "url" },
      ],
    },
  ])

describe("a Form in browse", () => {
  it("is one choice, its submit label first, and says what it asks", () => {
    const d = dialogOf(poster())
    expect(texts(d.turn, "content")).toContain("Details for the farmers market poster")
    expect(texts(d.turn, "content")).toContain("5 questions, all optional: Market time; First market day; Venue address; Stall fee; Contact email.")
    expect(d.turn.choices.map((c) => [c.node, c.act, c.label])).toEqual([
      ["details", "submit", "Run again with my answers"],
      ["details", "skip", "Skip: Details for the farmers market poster"],
      ["without", "activate", "Run again without them"],
    ])
  })
  it("offers no skip when a field is required", () => {
    expect(dialogOf(shipping()).turn.choices.map((c) => c.act)).toEqual(["submit"])
  })
})

describe("the sequence", () => {
  it("presents the prompt and the count, then asks the first field, all in one turn, with nothing sent", () => {
    const d = dialogOf(poster())
    const out = d.answer(numberOf(d.turn, "details", "submit"))
    expect(out.replies).toEqual([])
    expect(out.turn.state).toBe("value")
    expect(texts(out.turn, "content")).toEqual(["Details for the farmers market poster", "5 questions.", "Schedule:"])
    expect(question(out.turn)).toBe('Question 1 of 5: Market time. Say "skip" to leave it out or "skip all" to skip the whole form.')
    expect(out.turn.parts.find((p) => p.kind === "question")?.field).toBe("market_time")
  })

  it("announces a group heading only when the group changes", () => {
    const d = dialogOf(poster())
    d.answer("1")
    const second = d.answer("9am to 2pm").turn
    expect(texts(second, "content")).toEqual([]) // still Schedule
    const third = d.answer("2026-03-07").turn
    expect(texts(third, "content")).toEqual(["Place:"])
    const fourth = d.answer("Dubai Marina").turn
    expect(texts(fourth, "content")).toEqual(["Money:"])
  })

  it("asks each kind the way an Input of that kind is asked", () => {
    const d = dialogOf(kinds())
    d.answer("1")
    const asked: string[] = [question(d.turn)]
    for (const reply of ["Spring fair", "skip", "4", "250", "2026-03-07", "sam@example.com", "+971 50 123 4567", "https://example.com"]) asked.push(question(d.answer(reply).turn))
    expect(asked).toEqual([
      "Question 1 of 8, required: Event name",
      "Question 2 of 8: Tell us more. Say \"skip\" to leave it out.",
      "Question 3 of 8: How many guests (a number from 2 to 9). Say \"skip\" to leave it out.",
      "Question 4 of 8: Budget (an amount in AED of at least 5). Say \"skip\" to leave it out.",
      "Question 5 of 8: Which day (a date, like 2026-01-15). Say \"skip\" to leave it out.",
      "Question 6 of 8: Contact email (an email address). Say \"skip\" to leave it out.",
      "Question 7 of 8: Contact phone (a phone number). Say \"skip\" to leave it out.",
      "Question 8 of 8: Website (a web address). Say \"skip\" to leave it out.",
      expect.stringContaining('Say "send" to send the details'),
    ])
  })

  it("parses every kind into the value an Input of that kind sends", () => {
    const d = dialogOf(kinds())
    const replies = say(d, "1", "Spring fair", "Bring a hat.", "4", "AED 250", "2026-03-07", "sam@example.com", "+971 50 123 4567", "https://example.com", "send")
    expect(replies).toEqual([
      {
        experience: "test",
        node: "f",
        act: "submit",
        value: { name: "Spring fair", about: "Bring a hat.", guests: 4, budget: 250, day: "2026-03-07", mail: "sam@example.com", tel: "+971 50 123 4567", site: "https://example.com" },
      },
    ])
  })
})

describe("skipping and required fields", () => {
  it("lets an optional field be skipped with the skip word, leaving it unanswered", () => {
    const d = dialogOf(shipping())
    say(d, "1", "Sam Rivera", "1 Marina Walk", "Dubai", "skip")
    expect(d.turn.state).toBe("review")
    expect(texts(d.turn, "content")).toContain("4. Phone for the courier: not answered.")
  })

  it("does not let a required field be skipped, and asks it again with the reason", () => {
    const d = dialogOf(shipping())
    d.answer("1")
    const out = d.answer("skip")
    expect(out.replies).toEqual([])
    expect(problem(out.turn)).toBe("This one is required, so it cannot be skipped.")
    expect(question(out.turn)).toBe("Question 1 of 4, required: Full name")
  })

  it("re-asks a bad answer with the reason an Input gives, and keeps the answers so far", () => {
    const d = dialogOf(kinds())
    say(d, "1", "Spring fair", "skip")
    expect(problem(d.answer("12").turn)).toBe("12 is above the maximum 9.")
    expect(problem(d.answer("many").turn)).toBe("That is not a number.")
    expect(question(d.turn)).toMatch(/^Question 3 of 8: How many guests/)
    d.answer("4")
    expect(question(d.turn)).toMatch(/^Question 4 of 8: Budget/)
    expect(problem(d.answer("2").turn)).toMatch(/below the minimum 5/)
    say(d, "50", "skip", "not an email")
    expect(problem(d.turn)).toMatch(/is not an email address/)
  })

  it("re-asks a bad required answer, here a text over its limit", () => {
    const d = dialogOf(kinds())
    d.answer("1")
    expect(problem(d.answer("This name is much too long for the field").turn)).toMatch(/characters; the most is 20/)
    expect(d.turn.state).toBe("value")
  })

  it("skips the whole form at its start with one skip reply, by the choice or by 'skip all'", () => {
    expect(say(dialogOf(poster()), "2")).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
    const d = dialogOf(poster())
    expect(say(d, "1", "skip all")).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
    expect(texts(d.turn, "outcome")).toEqual(["Skipped."])
  })

  it("does not skip the whole form once it has begun, or when a field is required", () => {
    const d = dialogOf(poster())
    expect(say(d, "1", "9am", "skip all")).toEqual([])
    expect(problem(d.turn)).toMatch(/only at its start/)
    const s = dialogOf(shipping())
    expect(say(s, "1", "skip all")).toEqual([])
    expect(problem(s.turn)).toMatch(/only at its start/)
  })

  it("ends in a skip reply when every optional question was skipped and the person then says skip", () => {
    const d = dialogOf(poster())
    say(d, "1", "skip", "skip", "skip", "skip", "skip")
    expect(d.turn.state).toBe("review")
    expect(question(d.turn)).toMatch(/not answered anything/)
    expect(say(d, "send")).toEqual([])
    expect(problem(d.turn)).toMatch(/nothing to send/)
    expect(say(d, "skip")).toEqual([{ experience: "poster_details", node: "details", act: "skip" }])
  })
})

describe("the read-back", () => {
  const upToReview = () => {
    const d = dialogOf(poster())
    const replies = say(d, "1", "9am to 2pm", "2026-03-07", "skip", "25", "sam@example.com")
    return { d, replies }
  }

  it("says every answer once, in order, and sends nothing until the person sends", () => {
    const { d, replies } = upToReview()
    expect(replies).toEqual([])
    expect(d.turn.state).toBe("review")
    expect(texts(d.turn, "content")).toEqual([
      "Your answers:",
      '1. Market time: "9am to 2pm".',
      "2. First market day: Mar 7, 2026.",
      "3. Venue address: not answered.",
      "4. Stall fee: AED 25.",
      '5. Contact email: "sam@example.com".',
    ])
    expect(question(d.turn)).toBe('Say "send" to run again with my answers, or "change" and a number from 1 to 5 or a field name.')
  })

  it("produces no reply for anything but the send word", () => {
    const { d } = upToReview()
    for (const line of ["ok", "go ahead", "please", "no", "6", "change", "change 9", "skip", "help", "repeat", "?"]) {
      expect(d.answer(line).replies, line).toEqual([])
      expect(d.turn.state, line).toBe("review")
    }
  })

  it("sends one submit reply with only the answered fields, in field order", () => {
    const { d } = upToReview()
    const out = d.answer("send")
    expect(out.replies).toEqual([
      {
        experience: "poster_details",
        node: "details",
        act: "submit",
        value: { market_time: "9am to 2pm", opening_date: "2026-03-07", stall_fee: 25, contact: "sam@example.com" },
      },
    ])
    expect(Object.keys((out.replies[0]!.value as object))).not.toContain("venue")
    expect(texts(out.turn, "outcome")).toEqual(["Noted: 4 answers."])
    expect(out.turn.choices.map((c) => c.node)).toEqual(["without"])
  })

  it("accepts the submit label, 'submit' and 'yes' as the send word", () => {
    for (const word of ["Run again with my answers", "submit", "yes", "SEND!"]) {
      const { d } = upToReview()
      expect(d.answer(word).replies, word).toHaveLength(1)
    }
  })

  it("changes one answer by number, and asks only that question, then reads back again", () => {
    const { d } = upToReview()
    const out = d.answer("change 1")
    expect(out.replies).toEqual([])
    expect(out.turn.state).toBe("value")
    expect(texts(out.turn, "content")).toEqual(['Now: "9am to 2pm".'])
    expect(question(out.turn)).toMatch(/^Change question 1: Market time/)
    expect(d.answer("8am to noon").turn.state).toBe("review")
    expect(texts(d.turn, "content")).toContain('1. Market time: "8am to noon".')
    expect(d.answer("send").replies[0]!.value).toMatchObject({ market_time: "8am to noon" })
  })

  it("changes one answer by field name (prompt or id), or by the bare number", () => {
    for (const phrase of ["change venue address", "Change Venue Address", "change venue", "venue address", "change place", "3"]) {
      const { d } = upToReview()
      if (phrase === "change place") {
        expect(d.answer(phrase).turn.state).toBe("review") // not a name of a field: nothing guessed
        continue
      }
      expect(d.answer(phrase).turn.state, phrase).toBe("value")
      expect(question(d.turn), phrase).toMatch(/^Change question 3: Venue address/)
    }
    const { d } = upToReview()
    d.answer("edit market_time")
    expect(question(d.turn)).toMatch(/^Change question 1/)
  })

  it("fills in a field that was left out, and takes an answer out with the skip word", () => {
    const { d } = upToReview()
    say(d, "change 3", "Pier 7")
    expect(texts(d.turn, "content")).toContain('3. Venue address: "Pier 7".')
    say(d, "change 5", "skip")
    expect(texts(d.turn, "content")).toContain("5. Contact email: not answered.")
    expect(d.answer("send").replies[0]!.value).toEqual({ market_time: "9am to 2pm", opening_date: "2026-03-07", venue: "Pier 7", stall_fee: 25 })
  })

  it("does not take a required answer out, and re-asks a bad change", () => {
    const d = dialogOf(shipping())
    say(d, "1", "Sam", "1 Marina Walk", "Dubai", "skip", "change 1")
    expect(problem(d.answer("skip").turn)).toMatch(/required/)
    expect(d.turn.state).toBe("value")
    d.answer("Sam Rivera")
    expect(d.turn.state).toBe("review")
  })

  it("lets the person leave a change with 'back' and keeps the answer", () => {
    const { d } = upToReview()
    say(d, "change 1", "back")
    expect(d.turn.state).toBe("review")
    expect(texts(d.turn, "content")).toContain('1. Market time: "9am to 2pm".')
  })
})

describe("going back and cancelling", () => {
  it("'back' returns to the question before and keeps its answer; at the first question it drops the form", () => {
    const d = dialogOf(poster())
    say(d, "1", "9am", "2026-03-07", "back")
    expect(question(d.turn)).toMatch(/^Question 2 of 5/)
    say(d, "back", "back")
    expect(d.turn.state).toBe("browse")
    expect(texts(d.turn, "hint")).toEqual(["Nothing was sent."])
  })

  it("'cancel' drops the form with nothing sent, and the form can be started again from nothing", () => {
    const d = dialogOf(shipping())
    const sent = say(d, "1", "Sam", "1 Marina Walk", "Dubai", "skip", "cancel")
    expect(sent).toEqual([])
    expect(d.turn.state).toBe("browse")
    d.answer("1")
    expect(question(d.turn)).toBe("Question 1 of 4, required: Full name")
    expect(d.turn.parts.some((p) => p.text.includes("Sam"))).toBe(false)
  })

  it("never sends from a read-back that was cancelled", () => {
    const d = dialogOf(shipping())
    expect(say(d, "1", "Sam", "1 Marina Walk", "Dubai", "skip", "cancel", "send")).toEqual([])
  })
})

describe("one act, one reply", () => {
  it("sends the required form with its optional field left out", () => {
    const d = dialogOf(shipping())
    expect(say(d, "1", "Sam Rivera", "1 Marina Walk", "Dubai", "skip", "send")).toEqual([
      { experience: "shipping_address", node: "address", act: "submit", value: { name: "Sam Rivera", street: "1 Marina Walk", city: "Dubai" } },
    ])
    expect(d.done).toBe(true)
  })

  it("never sends field by field: the only reply across the whole conversation is the last", () => {
    const d = dialogOf(shipping())
    const per: number[] = []
    for (const line of ["1", "Sam", "1 Marina Walk", "Dubai", "+971 50 123 4567", "send"]) per.push(d.answer(line).replies.length)
    expect(per).toEqual([0, 0, 0, 0, 0, 1])
  })

  it("is the same on a web plan, where text is the fallback", () => {
    const d = dialogOf(shipping(), WEB)
    expect(say(d, "1", "Sam", "1 Marina Walk", "Dubai", "skip", "send")).toHaveLength(1)
  })

  it("is deterministic: the same inputs give the same turns and replies", () => {
    const run = () => {
      const d = dialogOf(poster())
      return ["1", "9am", "bad date", "2026-03-07", "skip", "x", "send", "change 2", "2026-04-01", "send"].map((l) => JSON.stringify(d.answer(l)))
    }
    expect(run()).toEqual(run())
  })

  it("never throws and sends nothing for hostile input", () => {
    const d = dialogOf(poster())
    d.answer("1")
    for (const line of ["", "   ", "\u0000", "x".repeat(10000), "__proto__", "constructor", "change __proto__", "?"]) expect(() => d.answer(line)).not.toThrow()
    expect(d.answer("skip").replies).toEqual([])
  })

  it("keeps the form's words in the plan's locale for money and dates", () => {
    const d = dialogOf({ ...poster(), locale: "de" })
    say(d, "1", "skip", "2026-03-07", "skip", "25", "skip")
    expect(texts(d.turn, "content").join(" ")).toMatch(/07\.03\.2026|7\. März 2026/)
  })
})
