import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Block } from "../core/blocks"
import type { TurnEvent } from "../core/conversation"
import type { PreparedScene } from "../core/prepared"
import { createRegistry } from "../core/registry"
import { LivingPage, useConversation } from "./living-page"

const speaker = { kind: "person", name: "Alee" } as const
const Statement = ({ block }: { block: Block }) => <p>{block.title}</p>
const registry = createRegistry({ statement: Statement })
const scene: PreparedScene = { intent: "work", ask: "Show me the work", line: "Here it is.", blocks: [{ block: "statement", title: "Selected work" }] }

async function* answer(...events: TurnEvent[]) {
  for (const e of events) yield e
}
const say = (text: string): TurnEvent[] => [{ type: "word", text }, { type: "done" }]

describe("useConversation", () => {
  it("plays a prepared scene at once without calling onAsk", () => {
    const onAsk = vi.fn()
    const { result } = renderHook(() => useConversation({ prepared: [scene], onAsk }))
    act(() => void result.current.ask("show me the work"))
    expect(onAsk).not.toHaveBeenCalled()
    const t = result.current.turns[0]
    expect(t).toMatchObject({ id: "turn-1", prepared: true, status: "done" })
    expect(t.words.join("")).toBe("Here it is.")
    expect(t.blocks).toHaveLength(1)
  })
  it("streams the host's events with deterministic ids and finishes", async () => {
    const onAsk = vi.fn(() => answer({ type: "phase", label: "Reading" }, ...say("Hello")))
    const { result } = renderHook(() => useConversation({ onAsk }))
    act(() => void result.current.ask("hi"))
    act(() => void result.current.ask("   "))
    await waitFor(() => expect(result.current.turns[0].status).toBe("done"))
    expect(result.current.turns.map((t) => t.id)).toEqual(["turn-1"])
    expect(result.current.turns[0].words).toEqual(["Hello"])
  })
  it("ends a stream that forgot done, and reports a failed one with a next step", async () => {
    const { result } = renderHook(() => useConversation({ onAsk: (ask) => (ask === "bad" ? ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error("boom")) }) }) : answer({ type: "word", text: "x" })) }))
    act(() => void result.current.ask("ok"))
    await waitFor(() => expect(result.current.turns[0].status).toBe("done"))
    act(() => void result.current.ask("bad"))
    await waitFor(() => expect(result.current.turns[1].status).toBe("error"))
    expect(result.current.turns[1].error?.next).toBeTruthy()
  })
  it("says so when there is no model and no prepared scene", () => {
    const { result } = renderHook(() => useConversation())
    act(() => void result.current.ask("anything"))
    expect(result.current.turns[0].status).toBe("error")
  })
  it("stop aborts the signal; a new ask stops the previous", async () => {
    const signals: AbortSignal[] = []
    const onAsk = (_: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return (async function* () {
        yield { type: "word", text: "slow" } as TurnEvent
        await new Promise((r) => setTimeout(r, 300))
        yield { type: "word", text: " more" } as TurnEvent
      })()
    }
    const { result } = renderHook(() => useConversation({ onAsk }))
    act(() => void result.current.ask("one"))
    await waitFor(() => expect(result.current.turns[0].words).toEqual(["slow"]))
    act(() => result.current.stop())
    expect(signals[0].aborted).toBe(true)
    expect(result.current.turns[0].status).toBe("stopped")
    expect(result.current.streaming).toBe(false)
    act(() => void result.current.ask("two"))
    act(() => void result.current.ask("three"))
    expect(signals[1].aborted).toBe(true)
    expect(result.current.turns.map((t) => t.status)).toEqual(["stopped", "stopped", "thinking"])
    await new Promise((r) => setTimeout(r, 400))
    expect(result.current.turns[0].words).toEqual(["slow"])
  })
  it("folds one and all", () => {
    const { result } = renderHook(() => useConversation({ prepared: [scene] }))
    act(() => void result.current.ask("work"))
    act(() => result.current.fold("turn-1"))
    expect(result.current.turns[0].folded).toBe(true)
    act(() => result.current.fold("turn-1", false))
    expect(result.current.turns[0].folded).toBe(false)
    act(() => result.current.foldAll())
    expect(result.current.turns[0].folded).toBe(true)
  })
})

const page = (props: Partial<React.ComponentProps<typeof LivingPage>> = {}) => (
  <LivingPage speaker={speaker} registry={registry} prepared={[scene]} {...props}>
    <section data-living-section="hero" aria-label="Hero">Hero</section>
    <section data-living-section="work" aria-label="Work">Work</section>
    <section data-living-section="contact" aria-label="Contact">Contact</section>
  </LivingPage>
)

describe("LivingPage", () => {
  let rects: Record<string, { top: number; bottom: number }>
  let scrollTo: ReturnType<typeof vi.fn>
  beforeEach(() => {
    rects = {}
    scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const r = rects[this.dataset.livingSection ?? this.id] ?? { top: 0, bottom: 0 }
      return { ...r, left: 0, right: 0, width: 0, height: r.bottom - r.top, x: 0, y: r.top, toJSON() {} }
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it("keeps the base page readable and the composer disclosed before any turn", () => {
    render(page())
    expect(screen.getByText("Hero")).toBeTruthy()
    expect(screen.getByText(/AI agent answering/)).toBeTruthy()
    expect(document.querySelector('[data-slot="living-dock"]')?.getAttribute("data-variant")).toBe("inline")
  })
  it("inserts the turn right after the section in view and docks the composer", async () => {
    rects = { hero: { top: -900, bottom: -100 }, work: { top: -100, bottom: 700 }, contact: { top: 700, bottom: 1500 } }
    render(page())
    await userEvent.click(screen.getByRole("button", { name: "Show me the work" }))
    const turn = screen.getByRole("article", { name: "Show me the work" })
    const slot = turn.closest('[data-slot="turn-slot"]') as HTMLElement
    expect(slot.getAttribute("data-after")).toBe("work")
    expect(slot.previousElementSibling?.getAttribute("data-living-section")).toBe("work")
    expect(document.querySelector('[data-slot="living-dock"]')?.getAttribute("data-variant")).toBe("docked")
    expect(scrollTo).toHaveBeenCalled()
  })
  it("places later turns where the reader is then, in DOM order", async () => {
    rects = { hero: { top: 0, bottom: 800 } }
    render(page())
    await userEvent.type(screen.getByRole("textbox"), "tell me more{Enter}")
    rects = { work: { top: -100, bottom: 700 } }
    await userEvent.type(screen.getByRole("textbox"), "and more{Enter}")
    const slots = [...document.querySelectorAll('[data-slot="turn-slot"]')].filter((s) => s.querySelector("article"))
    expect(slots.map((s) => s.getAttribute("data-after"))).toEqual(["hero", "work"])
  })
  it("hides Jump to latest at the bottom and shows it when away", async () => {
    rects = { hero: { top: 0, bottom: 800 } }
    render(page())
    await userEvent.click(screen.getByRole("button", { name: "Show me the work" }))
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull()
    rects = { "turn-1": { top: 5000, bottom: 6000 } }
    fireEvent.scroll(window)
    expect(await screen.findByRole("button", { name: "Jump to latest" })).toBeTruthy()
  })
  it("Back to the page folds everything", async () => {
    render(page())
    await userEvent.click(screen.getByRole("button", { name: "Show me the work" }))
    await userEvent.click(screen.getByRole("button", { name: "Back to the page" }))
    expect(screen.getByRole("button", { name: /Show me the work — Selected work/ }).getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Back to the page" })).toBeNull()
  })
  it("streams a host answer and shows Stop meanwhile", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const onAsk = () =>
      (async function* () {
        yield { type: "word", text: "Hi" } as TurnEvent
        await gate
        yield { type: "done" } as TurnEvent
      })()
    render(page({ prepared: undefined, onAsk }))
    await userEvent.type(screen.getByRole("textbox"), "hello{Enter}")
    expect(await screen.findByRole("button", { name: "Stop" })).toBeTruthy()
    await act(async () => release())
    expect(await screen.findByRole("button", { name: "Send" })).toBeTruthy()
  })
})

describe("useLivingAsk", () => {
  it("lets the base page ask, and is null outside a LivingPage", async () => {
    const { useLivingAsk } = await import("./living-page")
    const seen: Array<unknown> = []
    function Probe() {
      seen.push(useLivingAsk())
      return null
    }
    render(<Probe />)
    expect(seen.at(-1)).toBeNull()
  })
})
