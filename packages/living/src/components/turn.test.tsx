import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Turn } from "../core/conversation"
import { createRegistry } from "../core/registry"
import type { Block } from "../core/blocks"
import { LivingTurn } from "./turn"

const speaker = { kind: "person", name: "Alee" } as const
const Statement = ({ block }: { block: Block }) => <p data-slot="test-statement">statement:{block.title}</p>
const Work = ({ block }: { block: Block }) => <p data-slot="test-work">work:{block.title}</p>
const registry = createRegistry({ statement: Statement, work: Work })

const base: Turn = { id: "turn-1", ask: "Show me the work", phase: null, words: [], blocks: [], asks: [], status: "done", error: null, folded: false, prepared: false }
const turn = (t: Partial<Turn>): Turn => ({ ...base, ...t })

describe("LivingTurn", () => {
  it("names the phase as text before any word, never dots, in a polite region", () => {
    const { container } = render(<LivingTurn turn={turn({ status: "thinking", phase: "Looking through the work" })} speaker={speaker} registry={registry} />)
    expect(screen.getByText("Looking through the work").closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite")
    expect(container.textContent).not.toMatch(/[.…]{3}|•/)
    expect(container.querySelector('[data-slot="turn-line"]')).toBeNull()
  })
  it("shows the ask as a caption, the byline and the spoken words in the voice face", () => {
    render(<LivingTurn turn={turn({ status: "speaking", words: ["I make", " things", " slowly."] })} speaker={speaker} registry={registry} />)
    expect(screen.getByRole("article", { name: "Show me the work" })).toBeTruthy()
    expect(screen.getByText("Alee")).toBeTruthy()
    const line = document.querySelector('[data-slot="turn-line"]') as HTMLElement
    expect(line.textContent).toBe("I make things slowly.")
    expect(line.className).toContain("font-voice")
    expect(line.querySelectorAll('[data-slot="turn-word"]')).toHaveLength(3)
  })
  it("renders at most three blocks, an unknown kind as the statement block", () => {
    const blocks = [{ block: "work", title: "A" }, { block: "faq", title: "B" }, { block: "work", title: "C" }, { block: "work", title: "D" }] as Block[]
    render(<LivingTurn turn={turn({ blocks })} speaker={speaker} registry={registry} />)
    expect(screen.getAllByText(/^(work|statement):/)).toHaveLength(3)
    expect(screen.getByText("statement:B")).toBeTruthy()
  })
  it("offers the next asks as buttons", async () => {
    const onAsk = vi.fn()
    render(<LivingTurn turn={turn({ asks: ["Who are you?"] })} speaker={speaker} registry={registry} onAsk={onAsk} />)
    await userEvent.click(screen.getByRole("button", { name: "Who are you?" }))
    expect(onAsk).toHaveBeenCalledWith("Who are you?")
  })
  it("shows an inline error with a next step", () => {
    render(<LivingTurn turn={turn({ status: "error", error: { message: "I lost the thread.", next: "Ask again." } })} speaker={speaker} registry={registry} />)
    expect(screen.getByRole("alert").textContent).toContain("I lost the thread.")
    expect(screen.getByText("Ask again.")).toBeTruthy()
  })
  it("announces once when finished, never while streaming", () => {
    const { rerender } = render(<LivingTurn turn={turn({ status: "speaking", words: ["a"] })} speaker={speaker} registry={registry} />)
    expect(screen.getByRole("status", { hidden: true, name: "" }).textContent).toBe("")
    rerender(<LivingTurn turn={turn({ status: "done", words: ["a"] })} speaker={speaker} registry={registry} />)
    expect(screen.getByText("Answer ready")).toBeTruthy()
  })
  it("folds to a receipt button that reopens, and only a finished turn can fold", async () => {
    const onFold = vi.fn()
    const done = turn({ words: ["Fine."], blocks: [{ block: "work", title: "Selected work" }] })
    const { rerender } = render(<LivingTurn turn={done} speaker={speaker} registry={registry} onFold={onFold} />)
    await userEvent.click(screen.getByRole("button", { name: "Fold" }))
    expect(onFold).toHaveBeenCalledWith("turn-1", true)
    rerender(<LivingTurn turn={{ ...done, folded: true }} speaker={speaker} registry={registry} onFold={onFold} />)
    const receipt = screen.getByRole("button", { name: "Show me the work — Selected work" })
    expect(receipt.getAttribute("aria-expanded")).toBe("false")
    await userEvent.click(receipt)
    expect(onFold).toHaveBeenLastCalledWith("turn-1", false)
    rerender(<LivingTurn turn={turn({ status: "speaking", words: ["x"] })} speaker={speaker} registry={registry} onFold={onFold} />)
    expect(screen.queryByRole("button", { name: "Fold" })).toBeNull()
  })
})
