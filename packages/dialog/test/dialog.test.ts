import { describe, expect, it } from "vitest"
import { createDialog, normalize } from "../src/index.ts"
import { dialogOf, experience, fixture, numberOf, planOf, texts, WEB } from "./helpers.ts"

const campaign = () => fixture("ad-campaign-launch.json")

describe("browse", () => {
  it("says every node first, then the consequence verbatim, then the choices in plan order with the primary first", () => {
    const d = dialogOf(campaign())
    const { turn } = d
    expect(turn.state).toBe("browse")
    expect(texts(turn, "content")).toEqual([
      "Recommended: Recommended test: 7 days, purchase objective",
      "Maximum spend: AED 1,050.",
      "Confirm spend. This cannot be undone.",
      "Or: spend less.",
      "Or: set my own budget, and you give a price.",
    ])
    expect(texts(turn, "consequence")).toEqual(["Spends AED 1,050"])
    // The consequence follows the node it belongs to.
    expect(turn.parts.findIndex((p) => p.kind === "consequence")).toBe(turn.parts.findIndex((p) => p.node === "go") + 1)
    expect(turn.choices.map((c) => [c.n, c.node, c.act])).toEqual([
      [1, "go", "confirm"],
      [2, "rec", "accept"],
      [3, "less", "choose"],
      [4, "own", "choose"],
    ])
    expect(turn.parts.at(-1)?.kind).toBe("question")
    expect(d.done).toBe(false)
  })

  it("never lists an IrreversibleAction's cancel, and a node with no acts offers nothing", () => {
    expect(dialogOf(campaign()).turn.choices.some((c) => c.act === "cancel")).toBe(false)
    const d = dialogOf(experience([{ type: "Text", id: "t", text: "Hello" }, { type: "Status", id: "s", state: "done", label: "Saved" }]))
    expect(d.done).toBe(true)
    expect(d.turn.state).toBe("done")
    expect(texts(d.turn)).toEqual(["Hello", "Saved: done."])
  })

  it("picks by number, label or the act's word, case-insensitively, ignoring trailing punctuation", () => {
    for (const input of ["3", "Spend less", "SPEND LESS!", "  spend   less. "]) {
      const d = dialogOf(campaign())
      expect(d.answer(input).replies, input).toEqual([{ experience: "approve_campaign", node: "less", act: "choose" }])
    }
    const d = dialogOf(campaign())
    expect(d.answer("accept").replies).toEqual([{ experience: "approve_campaign", node: "rec", "act": "accept" }])
  })

  it("answers each node once", () => {
    const d = dialogOf(campaign())
    d.answer("3")
    expect(d.turn.choices.map((c) => c.node)).toEqual(["go", "rec", "own"])
    expect(d.turn.parts.some((p) => p.kind === "outcome" && p.node === "less")).toBe(true)
    expect(d.answer("spend less").replies).toEqual([])
  })

  it("is done when nothing is left, and its parts hold the outcomes", () => {
    const d = dialogOf(experience([{ type: "Action", id: "a", intent: "save it" }, { type: "Warning", id: "w", text: "Careful", acknowledge: true }]))
    expect(d.answer("1").replies).toHaveLength(1)
    const out = d.answer("1")
    expect(out.replies).toHaveLength(1)
    expect(d.done).toBe(true)
    expect(d.turn.state).toBe("done")
    expect(d.turn.choices).toEqual([])
    expect(texts(d.turn, "outcome").sort()).toEqual(["Acknowledged.", "Done: Save it."])
    expect(d.answer("1")).toEqual({ turn: expect.objectContaining({ state: "done" }), replies: [] })
  })

  it("lets ExploreMore be asked again", () => {
    const d = dialogOf(fixture("news-article.json"))
    const n = numberOf(d.turn, "explore")
    d.answer(n)
    expect(d.answer("skip").replies).toHaveLength(1)
    d.answer(n)
    expect(d.answer("2").replies).toEqual([{ experience: "read_article", node: "explore", act: "expand", value: "medical research" }])
    expect(d.done).toBe(false)
    // Without topics it needs no value and is sent at once.
    const plain = dialogOf(experience([{ type: "ExploreMore", id: "m", intent: "more" }]))
    expect(plain.answer("1").replies).toEqual([{ experience: "test", node: "m", act: "expand" }])
    expect(plain.answer("1").replies).toHaveLength(1)
    expect(plain.done).toBe(false)
  })

  it("asks again, changing nothing, for what it does not understand (no fuzzy matching)", () => {
    const d = dialogOf(campaign())
    for (const input of ["spend", "spend les", "launch", "9", "0", "go ahead"]) {
      const out = d.answer(input)
      expect(out.replies, input).toEqual([])
      expect(texts(out.turn, "problem"), input).toHaveLength(1)
      expect(out.turn.state).toBe("browse")
      expect(out.turn.choices).toHaveLength(4)
    }
  })

  it("repeats on help, ? and repeat, with a hint for the first two", () => {
    const d = dialogOf(campaign())
    for (const input of ["help", "?", "Help!"]) {
      const out = d.answer(input)
      expect(texts(out.turn, "hint"), input).toHaveLength(1)
      expect(out.turn.choices).toHaveLength(4)
      expect(texts(out.turn, "content")).toHaveLength(5)
    }
    const again = d.answer("repeat")
    expect(texts(again.turn, "hint")).toEqual([])
    expect(texts(again.turn, "content")).toHaveLength(5)
  })
})

describe("value", () => {
  it("asks an Alternative with an input for its value: { amount, currency }, in the experience's currency by default", () => {
    const d = dialogOf(campaign())
    const out = d.answer("4")
    expect(out.turn.state).toBe("value")
    expect(texts(out.turn, "question")).toHaveLength(1)
    expect(d.answer("500").replies).toEqual([{ experience: "approve_campaign", node: "own", act: "choose", value: { amount: 500, currency: "AED" } }])
    const e = dialogOf(campaign())
    e.answer("4")
    expect(e.answer("250 usd").replies[0]?.value).toEqual({ amount: 250, currency: "USD" })
  })

  it("back returns to browse", () => {
    const d = dialogOf(campaign())
    d.answer("4")
    const out = d.answer("back")
    expect(out.turn.state).toBe("browse")
    expect(out.replies).toEqual([])
    expect(out.turn.choices).toHaveLength(4)
  })

  it("gives a problem part and no reply for an invalid value, then asks again", () => {
    const d = dialogOf(experience([{ type: "Input", id: "n", intent: "party size", prompt: "How many?", kind: "number", min: 1, max: 12, required: true }]))
    d.answer("1")
    for (const input of ["13", "0", "lots", "-3"]) {
      const out = d.answer(input)
      expect(out.replies, input).toEqual([])
      expect(out.turn.state).toBe("value")
      expect(texts(out.turn, "problem"), input).toHaveLength(1)
      expect(texts(out.turn, "question")).toHaveLength(1)
    }
    expect(d.answer("4").replies).toEqual([{ experience: "test", node: "n", act: "submit", value: 4 }])
  })

  it("encodes values as the IR says: numbers as numbers, dates as ISO strings, text as typed", () => {
    const ir = experience([
      { type: "Input", id: "n", intent: "n", prompt: "N?", kind: "number" },
      { type: "Input", id: "m", intent: "m", prompt: "Money?", kind: "money", currency: "AED" },
      { type: "Input", id: "d", intent: "d", prompt: "Date?", kind: "date" },
      { type: "Input", id: "e", intent: "e", prompt: "Email?", kind: "email" },
      { type: "Input", id: "t", intent: "t", prompt: "Text?", kind: "text" },
    ])
    const d = dialogOf(ir)
    const run = (node: string, input: string) => {
      d.answer(numberOf(d.turn, node, "submit"))
      return d.answer(input)
    }
    expect(run("n", "1,250.5").replies[0]?.value).toBe(1250.5)
    expect(run("m", "42 aed").replies[0]?.value).toBe(42)
    expect(run("d", "2026-01-15").replies[0]?.value).toBe("2026-01-15")
    expect(run("e", "Sam@Example.com").replies[0]?.value).toBe("Sam@Example.com")
    expect(run("t", "Hello, World!").replies[0]?.value).toBe("Hello, World!")
  })

  it("rejects a bad date, a bad email and a too-long text", () => {
    const d = dialogOf(experience([{ type: "Input", id: "d", intent: "d", prompt: "Date?", kind: "date" }]))
    d.answer("1")
    expect(d.answer("next tuesday").replies).toEqual([])
    expect(d.turn.state).toBe("value")
  })

  it("Choice: picks by number, label or id; a multiple Choice takes several separated by commas", () => {
    const ir = experience([
      { type: "Choice", id: "size", intent: "pick a size", prompt: "Which size?", options: [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large" }] },
      { type: "Choice", id: "tops", intent: "pick toppings", prompt: "Toppings?", multiple: true, options: [{ id: "a", label: "Anchovies" }, { id: "b", label: "Basil" }, { id: "c", label: "Capers" }] },
    ])
    for (const input of ["2", "Medium", "medium.", "m"]) {
      const d = dialogOf(ir)
      d.answer("1")
      expect(d.turn.choices.map((c) => c.label)).toEqual(["Small", "Medium", "Large"])
      expect(d.answer(input).replies, input).toEqual([{ experience: "test", node: "size", act: "choose", value: "m" }])
    }
    const d = dialogOf(ir)
    d.answer(numberOf(d.turn, "tops"))
    expect(d.answer("1, capers").replies).toEqual([{ experience: "test", node: "tops", act: "choose", value: ["a", "c"] }])
    const e = dialogOf(ir)
    e.answer(numberOf(e.turn, "tops"))
    expect(e.answer("1, 1").replies).toEqual([])
    expect(texts(e.turn, "problem")).toHaveLength(1)
    expect(e.answer("1, nothing").replies).toEqual([])
    expect(e.turn.state).toBe("value")
  })

  it("Approval reject asks for an optional reason; skip sends none", () => {
    const ir = fixture("purchase-approval.json")
    const a = dialogOf(ir)
    const node = a.turn.choices.find((c) => c.act === "reject")!.node!
    a.answer(numberOf(a.turn, node, "reject"))
    expect(a.turn.state).toBe("value")
    expect(a.answer("skip").replies).toEqual([{ experience: ir.experience, node, act: "reject" }])
    const b = dialogOf(ir)
    b.answer(numberOf(b.turn, node, "reject"))
    expect(b.answer("Too expensive").replies).toEqual([{ experience: ir.experience, node, act: "reject", value: "Too expensive" }])
  })

  it("Preference: its options, or a typed value", () => {
    const ir = experience([
      { type: "Preference", id: "theme", intent: "theme", key: "theme", label: "Theme", value: "light", options: ["light", "dark"] },
      { type: "Preference", id: "vol", intent: "volume", key: "volume", label: "Volume", value: 3 },
    ])
    const d = dialogOf(ir)
    d.answer(numberOf(d.turn, "theme"))
    expect(d.answer("dark").replies).toEqual([{ experience: "test", node: "theme", act: "set", value: "dark" }])
    d.answer(numberOf(d.turn, "vol"))
    expect(d.turn.choices).toEqual([])
    expect(d.answer("7").replies).toEqual([{ experience: "test", node: "vol", act: "set", value: 7 }])
  })

  it("Correction takes free text; Input skip needs no value", () => {
    const ir = fixture("address-correction.json")
    const d = dialogOf(ir)
    const node = d.turn.choices[0]!.node!
    d.answer("1")
    expect(d.answer("12 Palm Street").replies[0]).toMatchObject({ node, act: "submit", value: "12 Palm Street" })
    const e = dialogOf(experience([{ type: "Input", id: "i", intent: "i", prompt: "Nickname?", kind: "text" }]))
    expect(e.turn.choices.map((c) => c.act)).toEqual(["submit", "skip"])
    expect(e.answer("skip").replies).toEqual([{ experience: "test", node: "i", act: "skip" }])
  })

  it("ExploreMore with topics asks for one, or skip", () => {
    const ir = experience([{ type: "ExploreMore", id: "more", intent: "learn more", topics: ["Pricing", "Safety"] }])
    const d = dialogOf(ir)
    d.answer("1")
    expect(d.turn.choices.map((c) => c.label)).toEqual(["Pricing", "Safety"])
    expect(d.answer("2").replies).toEqual([{ experience: "test", node: "more", act: "expand", value: "Safety" }])
    d.answer("1")
    expect(d.answer("skip").replies).toEqual([{ experience: "test", node: "more", act: "expand" }])
  })
})

describe("confirm", () => {
  const armed = () => {
    const d = dialogOf(campaign())
    d.answer("confirm")
    return d
  }

  it("arms the act and shows the consequence verbatim with one question", () => {
    const d = armed()
    expect(d.turn.state).toBe("confirm")
    expect(texts(d.turn, "consequence")).toEqual(["Spends AED 1,050"])
    expect(texts(d.turn, "question")).toEqual(['Type "confirm" to go ahead, or "cancel".'])
    expect(d.turn.choices).toEqual([])
  })

  it('does NOT commit on "1", "yes" or the act\'s own label', () => {
    const d = armed()
    for (const input of ["1", "yes", "Yes!", "y", "Confirm spend", "confirm spend", "go", "ok", "confirmed", "confirm it", "2"]) {
      const out = d.answer(input)
      expect(out.replies, input).toEqual([])
      expect(out.turn.state, input).toBe("confirm")
      expect(texts(out.turn, "problem"), input).toEqual(["Nothing was done."])
      expect(texts(out.turn, "question")).toHaveLength(1)
    }
    expect(d.answer("confirm").replies).toEqual([{ experience: "approve_campaign", node: "go", act: "confirm" }])
  })

  it("commits on the keyword, case-insensitively, trimmed", () => {
    for (const input of ["confirm", "CONFIRM", "Confirm", "  confirm  ", "confirm."]) {
      const d = armed()
      const out = d.answer(input)
      expect(out.replies, input).toEqual([{ experience: "approve_campaign", node: "go", act: "confirm" }])
      expect(texts(out.turn, "outcome")).toEqual(["Confirmed: spends AED 1,050."])
    }
  })

  it("matches the keyword after NFC normalization, in the plan's language", () => {
    const de = experience([{ type: "IrreversibleAction", id: "go", intent: "senden", consequence: { send: { to: "Sam", channel: "email" } } }], { locale: "de" })
    const nfd = "bestätigen"
    const nfc = "bestätigen"
    expect(nfd).not.toBe(nfc)
    for (const input of [nfd, nfc, nfd.toUpperCase()]) {
      const d = dialogOf(de)
      expect(d.turn.choices).toHaveLength(1)
      d.answer("1")
      expect(texts(d.turn, "question")[0]).toContain(nfc)
      expect(d.answer(input).replies, input).toEqual([{ experience: "test", node: "go", act: "confirm" }])
    }
    const english = dialogOf(de)
    english.answer("1")
    expect(english.answer("confirm").replies).toEqual([])
    // Arabic: a precomposed and a decomposed hamza are the same keyword.
    const ar = dialogOf(fixture("arabic-delivery-confirmation.json"))
    const go = ar.turn.choices.find((c) => c.act === "confirm")!
    ar.answer(String(go.n))
    expect(ar.answer("تأكيد".normalize("NFD")).replies).toHaveLength(1)
  })

  it("uses the keyword \"confirm\" on a web plan, which gives none", () => {
    const plan = planOf(campaign(), WEB)
    expect(plan.regions[0]!.nodes.find((n) => n.id === "go")?.keyword).toBeUndefined()
    const d = createDialog(plan)
    d.answer("confirm")
    expect(d.answer("1").replies).toEqual([])
    expect(d.answer("confirm").replies).toHaveLength(1)
  })

  it("backing out of an IrreversibleAction emits cancel, as the web organism's Cancel does", () => {
    for (const input of ["cancel", "back", "no", "Cancel!"]) {
      const d = armed()
      const out = d.answer(input)
      expect(out.replies, input).toEqual([{ experience: "approve_campaign", node: "go", act: "cancel" }])
      expect(texts(out.turn, "outcome")).toEqual(["Cancelled."])
      expect(out.turn.state).toBe("browse")
      expect(out.turn.choices.some((c) => c.node === "go")).toBe(false)
    }
  })

  it("backing out of another armed act emits nothing, and the act stays on offer", () => {
    const ir = experience([{ type: "Approval", id: "ap", intent: "approve payout", request: "Pay Sam", reversible: false, consequence: { spend: { amount: 20, currency: "USD" } } }])
    const plan = planOf(ir)
    expect(plan.regions[0]!.nodes[0]!.confirm).toBe("typed-keyword")
    const d = createDialog(plan)
    d.answer("approve")
    expect(d.turn.state).toBe("confirm")
    expect(d.answer("1").replies).toEqual([])
    const out = d.answer("cancel")
    expect(out.replies).toEqual([])
    expect(out.turn.state).toBe("browse")
    expect(out.turn.choices.map((c) => c.act)).toEqual(["approve", "reject"])
    d.answer("approve")
    expect(d.answer("confirm").replies).toEqual([{ experience: "test", node: "ap", act: "approve" }])
  })

  it("rejecting an armed-able node does not arm it", () => {
    const ir = experience([{ type: "Approval", id: "ap", intent: "approve payout", request: "Pay Sam", reversible: false, consequence: { spend: { amount: 20, currency: "USD" } } }])
    const d = dialogOf(ir)
    d.answer("reject")
    expect(d.turn.state).toBe("value")
    expect(d.answer("skip").replies).toEqual([{ experience: "test", node: "ap", act: "reject" }])
  })

  it("help in a confirm turn repeats it with a hint and does nothing", () => {
    const d = armed()
    const out = d.answer("help")
    expect(out.replies).toEqual([])
    expect(out.turn.state).toBe("confirm")
    expect(texts(out.turn, "hint")).toHaveLength(1)
    expect(texts(out.turn, "consequence")).toEqual(["Spends AED 1,050"])
  })
})

describe("readback", () => {
  const money = () => experience([{ type: "Input", id: "m", intent: "set budget", prompt: "How much?", kind: "money", currency: "AED", required: true }])

  it("says the value back and asks yes or no; yes sends it, no asks again", () => {
    const d = dialogOf(money(), undefined, { readback: true })
    d.answer("1")
    const out = d.answer("42")
    expect(out.replies).toEqual([])
    expect(out.turn.state).toBe("readback")
    expect(texts(out.turn)[0]).toBe("You said AED 42.")
    expect(texts(out.turn, "question")[0]).toMatch(/yes or no/i)

    const no = d.answer("no")
    expect(no.turn.state).toBe("value")
    expect(no.replies).toEqual([])
    d.answer("50")
    expect(d.answer("what").turn.state).toBe("readback")
    expect(d.answer("Yes").replies).toEqual([{ experience: "test", node: "m", act: "submit", value: 50 }])
  })

  it("accepts the plan's keyword as a yes, and never reads back an invalid value", () => {
    const d = dialogOf(money(), undefined, { readback: true })
    d.answer("1")
    const bad = d.answer("lots")
    expect(bad.turn.state).toBe("value")
    expect(texts(bad.turn, "problem")).toHaveLength(1)
    d.answer("42")
    expect(d.answer("confirm").replies).toHaveLength(1)
  })

  it("is off by default", () => {
    const d = dialogOf(money())
    d.answer("1")
    expect(d.answer("42").replies).toHaveLength(1)
  })
})

describe("a Choice that merges a prediction", () => {
  const ir = () => fixture("predicted-news-topic.json")

  it("offers accept and change on the prediction, not choose", () => {
    const d = dialogOf(ir())
    expect(d.turn.choices.map((c) => [c.node, c.act])).toEqual([["pred", "accept"], ["pred", "change"]])
    expect(d.turn.choices[0]!.label).toBe("Keep Technology news")
    expect(d.turn.choices.some((c) => c.act === "choose")).toBe(false)
    expect(texts(d.turn, "content")).toContain("Likely: Technology news, because You've read 15 tech articles this week.")
  })

  it("accept sends accept on the prediction", () => {
    const d = dialogOf(ir())
    expect(d.answer("accept").replies).toEqual([{ experience: "predict_preference", node: "pred", act: "accept" }])
    expect(d.done).toBe(true)
  })

  it("change lists the other options and sends the picked id", () => {
    const d = dialogOf(ir())
    d.answer("2")
    expect(d.turn.state).toBe("value")
    expect(d.turn.choices.map((c) => c.label)).toEqual(["Sports updates", "Music releases"])
    expect(d.answer("2").replies).toEqual([{ experience: "predict_preference", node: "pred", act: "change", value: "music" }])
    expect(d.done).toBe(true)
  })

  it("rejects the predicted option itself as a change", () => {
    const d = dialogOf(ir())
    d.answer("change")
    expect(d.answer("tech").replies).toEqual([])
    expect(d.turn.state).toBe("value")
  })

  it("offers a prediction beside an irreversible Choice as a note: only choose", () => {
    const e = experience([
      { type: "Choice", id: "c", intent: "pick", prompt: "Which?", reversible: false, options: [{ id: "x", label: "X" }, { id: "y", label: "Y" }] },
      { type: "IrreversibleAction", id: "go", intent: "send it", confirms: "c", consequence: { statement: "Sends your pick" } },
      { type: "PredictedChoice", id: "p", intent: "predict", of: "c", option: "x" },
    ])
    const d = dialogOf(e)
    expect(d.turn.choices.map((c) => [c.node, c.act])).toEqual([["go", "confirm"], ["c", "choose"]])
    expect(d.turn.parts.some((p) => p.node === "p")).toBe(true)
  })
})

describe("input handling", () => {
  it("normalizes: NFC, trim, whitespace, case folded with the locale, trailing . ! ?", () => {
    expect(normalize("  Café   Bar!?. ", "en")).toMatchObject({ raw: "Café Bar!?.", plain: "Café Bar", text: "café bar" })
    expect(normalize("?", "en").text).toBe("?")
    expect(normalize("...", "en").text).toBe("")
    expect(normalize("I", "tr").text).toBe("ı")
    expect(normalize("I", "en").text).toBe("i")
  })

  it("never throws on any string, in any turn", () => {
    const hostile = [
      "", " ", "\n", "\u0000", "😀", "👨‍👩‍👧‍👦🏳️‍🌈", "\ud800", "\udc00\ud800", "?".repeat(50_000), "!".repeat(100_000) + "x", "a".repeat(1_000_000),
      "9".repeat(100_000), "1,".repeat(50_000), "😀".repeat(200_000), " ".repeat(300_000), "{}", "__proto__", "constructor", "‮", "٣٤", "1e999", "NaN", "-0",
    ]
    const setups: Array<() => ReturnType<typeof dialogOf>> = [
      () => dialogOf(campaign()),
      () => { const d = dialogOf(campaign()); d.answer("4"); return d },
      () => { const d = dialogOf(campaign()); d.answer("confirm"); return d },
      () => { const d = dialogOf(experience([{ type: "Input", id: "m", intent: "m", prompt: "?", kind: "money", currency: "AED" }]), undefined, { readback: true }); d.answer("1"); d.answer("5"); return d },
      () => { const d = dialogOf(experience([{ type: "Input", id: "t", intent: "t", prompt: "?", kind: "text" }, { type: "Input", id: "d", intent: "d", prompt: "?", kind: "date" }])); d.answer("1"); return d },
      () => { const d = dialogOf(experience([{ type: "Choice", id: "c", intent: "c", prompt: "?", multiple: true, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }])); d.answer("1"); return d },
      () => { const d = dialogOf(experience([{ type: "Text", id: "t", text: "hi" }])); return d },
    ]
    for (const setup of setups) {
      for (const input of hostile) {
        const d = setup()
        let out
        expect(() => { out = d.answer(input) }, JSON.stringify(input.slice(0, 20))).not.toThrow()
        expect(out).toHaveProperty("turn.parts")
        expect(Array.isArray((out as unknown as { replies: unknown[] }).replies)).toBe(true)
      }
    }
    const d = dialogOf(campaign())
    expect(() => d.answer(undefined as unknown as string)).not.toThrow()
    expect(() => d.answer(null as unknown as string)).not.toThrow()
    expect(() => d.answer(42 as unknown as string)).not.toThrow()
    expect(() => d.answer({} as unknown as string)).not.toThrow()
  })

  it("never sends a reply that does not pass validateReply", () => {
    const d = dialogOf(experience([{ type: "Input", id: "n", intent: "n", prompt: "N?", kind: "number", max: 10 }]))
    d.answer("1")
    for (const input of ["11", "1e999", "Infinity", "NaN", "9".repeat(400)]) expect(d.answer(input).replies, input).toEqual([])
  })

  it("is deterministic: the same plan and inputs give the same turns and replies", () => {
    const run = () => {
      const d = dialogOf(campaign())
      const log: unknown[] = [d.turn]
      for (const input of ["help", "9", "own", "back", "4", "300", "confirm", "1", "cancel", "1", "confirm"]) log.push(d.answer(input))
      return JSON.stringify(log)
    }
    expect(run()).toBe(run())
    const a = createDialog(planOf(campaign()))
    const b = createDialog(structuredClone(planOf(campaign())))
    expect(JSON.stringify(a.turn)).toBe(JSON.stringify(b.turn))
  })

  it("checks replies against the experience it is given", () => {
    const ir = campaign()
    const d = createDialog(planOf(ir), { experience: ir })
    expect(d.answer("spend less").replies).toHaveLength(1)
  })
})
