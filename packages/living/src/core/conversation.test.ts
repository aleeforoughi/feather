import { describe, expect, it } from "vitest"
import { DEFAULT_PHASE, MAX_BLOCKS, conversationReducer, emptyConversation, isStreaming, receipt, spokenLine, type Conversation, type TurnEvent } from "./conversation"

const run = (events: TurnEvent[], start: Conversation = conversationReducer(emptyConversation, { type: "ask", id: "t1", ask: " Show me the work " })) => events.reduce((s, event) => conversationReducer(s, { type: "event", id: "t1", event }), start)

describe("conversationReducer", () => {
  it("opens a thinking turn with a named phase and a trimmed ask", () => {
    const t = conversationReducer(emptyConversation, { type: "ask", id: "t1", ask: " hi " }).turns[0]
    expect(t).toMatchObject({ ask: "hi", status: "thinking", phase: DEFAULT_PHASE, words: [], prepared: false, folded: false })
  })
  it("marks prepared turns and ignores a repeated id", () => {
    const s = conversationReducer(emptyConversation, { type: "ask", id: "t1", ask: "a", prepared: true })
    expect(s.turns[0].prepared).toBe(true)
    expect(conversationReducer(s, { type: "ask", id: "t1", ask: "b" })).toBe(s)
  })
  it("a new ask stops a turn still streaming and leaves finished ones", () => {
    let s = run([{ type: "done" }])
    s = conversationReducer(s, { type: "ask", id: "t2", ask: "b" })
    s = conversationReducer(s, { type: "ask", id: "t3", ask: "c" })
    expect(s.turns.map((t) => t.status)).toEqual(["done", "stopped", "thinking"])
  })
  it("names the phase until the first word, then clears it", () => {
    let s = run([{ type: "phase", label: "Looking through the work" }])
    expect(s.turns[0].phase).toBe("Looking through the work")
    s = run([{ type: "word", text: "Hello" }, { type: "phase", label: "late" }], s)
    expect(s.turns[0]).toMatchObject({ phase: null, status: "speaking", words: ["Hello"] })
    expect(run([{ type: "phase", label: "  " }]).turns[0].phase).toBe(DEFAULT_PHASE)
  })
  it("ignores empty words and caps blocks and asks", () => {
    const blocks = Array.from({ length: 5 }, (_, i) => ({ type: "block" as const, block: { block: "statement" as const, id: `b${i}` } }))
    const s = run([{ type: "word", text: "" }, ...blocks, { type: "asks", asks: ["a", " ", "b", "c", "d"] }])
    expect(s.turns[0].words).toEqual([])
    expect(s.turns[0].blocks).toHaveLength(MAX_BLOCKS)
    expect(s.turns[0].asks).toEqual(["a", "b", "c"])
  })
  it("finishes and errors, and then ignores events", () => {
    const e = run([{ type: "error", message: "No", next: "Try again" }])
    expect(e.turns[0]).toMatchObject({ status: "error", error: { message: "No", next: "Try again" } })
    expect(run([{ type: "error", message: "No" }]).turns[0].error).toEqual({ message: "No" })
    expect(run([{ type: "done" }, { type: "word", text: "x" }]).turns[0].words).toEqual([])
  })
  it("stops only an open turn", () => {
    const s = conversationReducer(run([]), { type: "stop", id: "t1" })
    expect(s.turns[0].status).toBe("stopped")
    expect(conversationReducer(run([{ type: "done" }]), { type: "stop", id: "t1" }).turns[0].status).toBe("done")
  })
  it("folds finished turns only, one and all", () => {
    const open = run([])
    expect(conversationReducer(open, { type: "fold", id: "t1", folded: true }).turns[0].folded).toBe(false)
    expect(conversationReducer(open, { type: "fold-all" }).turns[0].folded).toBe(false)
    const done = run([{ type: "done" }])
    const folded = conversationReducer(done, { type: "fold", id: "t1", folded: true })
    expect(folded.turns[0].folded).toBe(true)
    expect(conversationReducer(folded, { type: "fold", id: "t1", folded: false }).turns[0].folded).toBe(false)
    expect(conversationReducer(done, { type: "fold-all" }).turns[0].folded).toBe(true)
  })
})

describe("spokenLine, receipt, isStreaming", () => {
  it("joins words with their own spacing", () => {
    expect(spokenLine(run([{ type: "word", text: "Hello" }, { type: "word", text: " there" }]).turns[0])).toBe("Hello there")
  })
  it("receipts the ask and the first block title, else the first sentence", () => {
    expect(receipt(run([{ type: "block", block: { block: "work", title: "Selected work" } }]).turns[0])).toBe("Show me the work — Selected work")
    expect(receipt(run([{ type: "word", text: "I build things." }, { type: "word", text: " Many." }]).turns[0])).toBe("Show me the work — I build things.")
    expect(receipt(run([]).turns[0])).toBe("Show me the work")
  })
  it("shortens a long ask", () => {
    const s = conversationReducer(emptyConversation, { type: "ask", id: "t1", ask: "x".repeat(100) })
    expect(receipt(s.turns[0]).endsWith("…")).toBe(true)
  })
  it("streams while any turn is open", () => {
    expect(isStreaming(emptyConversation)).toBe(false)
    expect(isStreaming(run([]))).toBe(true)
    expect(isStreaming(run([{ type: "done" }]))).toBe(false)
  })
})
