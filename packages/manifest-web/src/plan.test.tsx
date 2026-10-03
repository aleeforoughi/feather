// The renderer applies what the plan decides, and decides nothing itself.
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { compose, REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { FeatherExperience, planNodes, PlanView } from "./index"
import { failOnConsole, FIXTURES, fixture } from "./test/fixtures"

const phone = REFERENCE_CONTEXTS.phone.context
const desktop = REFERENCE_CONTEXTS["desktop-detailed"].context
const lowVision = REFERENCE_CONTEXTS["low-vision-low-precision"].context
const screenless = REFERENCE_CONTEXTS.screenless.context
const textOnly: RenderContext = { capability: { output: { visual: "unavailable", audio: "unavailable" } } }

const view = (name: string, context: RenderContext, extra: Partial<React.ComponentProps<typeof FeatherExperience>> = {}) =>
  render(<FeatherExperience experience={fixture(name)} context={context} onReply={vi.fn()} {...extra} />)
const rootOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-slot="experience"]')!

describe("chrome", () => {
  failOnConsole()

  it("text-only renders as plain text, with no card", () => {
    const { container } = view("text-only", phone)
    expect(rootOf(container).getAttribute("data-chrome")).toBe("none")
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
    expect(container.querySelector('[data-slot="experience-card"]')).toBeNull()
    expect(screen.getByText("Your payment has been received and will be processed within 24 hours.")).toBeTruthy()
    expect(container.querySelector('[data-feather-node="msg"]')).not.toBeNull()
  })

  it("an experience with a decision is wrapped in a card", () => {
    const { container } = view("ad-campaign-launch", phone)
    expect(rootOf(container).getAttribute("data-chrome")).toBe("card")
    expect(container.querySelector('[data-slot="experience-card"]')).not.toBeNull()
  })

  it("renders the regions in order: main, then secondary", () => {
    const { container } = view("ad-campaign-launch", phone)
    const order = Array.from(container.querySelectorAll("[data-feather-node]"), (el) => el.getAttribute("data-feather-node"))
    // main: rec, cap, go; secondary: the alternatives, as one list.
    expect(order.indexOf("rec")).toBeLessThan(order.indexOf("cap"))
    expect(order.indexOf("cap")).toBeLessThan(order.indexOf("go"))
    expect(order.indexOf("go")).toBeLessThan(order.indexOf("~alternatives"))
    expect(order.indexOf("~alternatives")).toBeLessThan(order.indexOf("less"))
    expect(container.querySelector('[data-slot="experience-region"][data-variant="secondary"]')).not.toBeNull()
  })

  it("marks emphasis and the organism on every wrapper", () => {
    const { container } = view("ad-campaign-launch", phone)
    const go = container.querySelector('[data-feather-node="go"]')!
    expect(go.getAttribute("data-organism")).toBe("IrreversibleAction")
    expect(go.getAttribute("data-emphasis")).toBe("critical")
    expect(container.querySelector('[data-feather-node="cap"]')!.getAttribute("data-organism")).toBe("Price")
    // The alternatives are rows of one AlternativeList, marked as the nodes they are.
    const own = container.querySelector('[data-feather-node="own"]')!
    expect(own.getAttribute("data-organism")).toBe("AlternativeList")
    expect(own.getAttribute("data-slot")).toBe("alternative-list-item")
  })

  it("attaches a Tradeoff to its option and a requester to its approval", () => {
    const flight = view("flight-search-tradeoff", phone).container
    const composed = compose(fixture("flight-search-tradeoff"), phone)
    if (!composed.ok) throw new Error("invalid")
    const attached = planNodes(composed.plan).filter((n) => n.type === "Tradeoff")
    expect(attached.length).toBeGreaterThan(0)
    for (const t of attached) expect(flight.querySelector(`[data-feather-node="${t.id}"]`)!.getAttribute("data-organism")).toBe("Tradeoff")
    const { container } = view("purchase-approval", phone)
    expect(container.querySelector('[data-feather-node="req"]')!.textContent).toContain("Finance Manager")
    expect(container.querySelector('[data-feather-node="approve"] [data-feather-node="req"]')).not.toBeNull()
  })
})

describe("density, targets, motion and contrast", () => {
  failOnConsole()

  it("density sets data-density from the plan: compact is tight, comfortable default, spacious spacious", () => {
    expect(rootOf(view("ad-campaign-launch", phone).container).getAttribute("data-density")).toBe("default")
    expect(rootOf(view("ad-campaign-launch", desktop).container).getAttribute("data-density")).toBe("tight")
    expect(rootOf(view("ad-campaign-launch", lowVision).container).getAttribute("data-density")).toBe("spacious")
    // The unit never scales with density any more.
    expect(rootOf(view("ad-campaign-launch", desktop).container).style.getPropertyValue("--spacing")).toBe("")
  })

  it("writes minTarget as data-min-target; the 44 px targets come from the components, not from plan classes", () => {
    const touch = rootOf(view("user-signup", phone).container)
    expect(touch.getAttribute("data-min-target")).toBe("44")
    expect(touch.className).not.toContain("min-h-[44px]")
    const precise = rootOf(view("user-signup", desktop).container)
    expect(precise.getAttribute("data-min-target")).toBe("24")
  })

  it("contrast is exposed as data-contrast", () => {
    expect(rootOf(view("ad-campaign-launch", phone).container).getAttribute("data-contrast")).toBe("AA")
    expect(rootOf(view("ad-campaign-launch", lowVision).container).getAttribute("data-contrast")).toBe("AAA")
  })

  it("motion reduced makes organisms move as if the OS asked", () => {
    // The Approval's attention ring pulses only when motion is full.
    const pulses = (c: HTMLElement) => c.querySelectorAll('[data-slot="attention-card"] .ring-4').length
    const full = view("purchase-approval", phone)
    expect(rootOf(full.container).getAttribute("data-motion")).toBe("full")
    expect(pulses(full.container)).toBe(1)
    full.unmount()
    const reduced = view("purchase-approval", lowVision)
    expect(rootOf(reduced.container).getAttribute("data-motion")).toBe("reduced")
    expect(pulses(reduced.container)).toBe(0)
    reduced.unmount()
    // A persona asking for reduced motion, with nothing from the OS, reduces it too.
    const persona = view("purchase-approval", { persona: { motion: "reduced" } })
    expect(pulses(persona.container)).toBe(0)
  })

  it("writes the document's language and direction", () => {
    const { container } = view("arabic-delivery-confirmation", phone)
    const root = rootOf(container)
    expect(root.getAttribute("lang")).toBe("ar-AE")
    expect(root.getAttribute("dir")).toBe("rtl")
    expect(rootOf(view("ad-campaign-launch", phone).container).getAttribute("dir")).toBe("ltr")
  })
})

describe("expanded, confirm and preselected", () => {
  failOnConsole()

  it('"Why?" starts open or closed as the plan says; critical detail is never hidden', () => {
    const why = (c: HTMLElement) => c.querySelector('[data-slot="why-disclosure-trigger"]')
    expect(why(view("ad-campaign-launch", phone).container)!.getAttribute("aria-expanded")).toBe("false")
    const detailed = view("ad-campaign-launch", desktop)
    expect(why(detailed.container)!.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getAllByText("Enough to test three creative directions without overspending.").length).toBeGreaterThan(0)
  })

  it("a node with detail and no organism of its own shows it from `expanded` too", () => {
    const { container } = view("help-article", desktop)
    expect(container.querySelector('[data-slot="why-disclosure-trigger"][aria-expanded="true"]')).not.toBeNull()
    const closed = view("help-article", phone).container
    expect(closed.querySelector('[data-slot="why-disclosure-trigger"][aria-expanded="false"]')).not.toBeNull()
  })

  it("an irreversible act renders in confirm mode: two deliberate presses", () => {
    const { container } = view("ad-campaign-launch", phone)
    expect(container.querySelector('[data-slot="irreversible-action"]')!.getAttribute("data-mode")).toBe("confirm")
  })

  it("a Choice preselects what the plan says, and never an irreversible one", () => {
    view("choice-three-options", phone)
    expect(screen.getByRole("radio", { name: /Standard/ }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("radio", { name: /Express/ }).getAttribute("aria-checked")).toBe("false")
  })
})

describe("focus", () => {
  failOnConsole()

  it("starts on the plan's focus node, in its first control", () => {
    const { container } = view("choice-three-options", phone)
    const composed = compose(fixture("choice-three-options"), phone)
    if (!composed.ok) throw new Error("invalid")
    expect(composed.plan.focus).toBe("speed")
    expect(container.querySelector('[data-feather-node="speed"]')!.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
  })

  it("never starts on an irreversible act", () => {
    view("ad-campaign-launch", phone)
    expect(document.activeElement).toBe(document.body)
  })

  it("lands on plan.focus and nowhere else, for every fixture in every context", () => {
    for (const { name, ir } of FIXTURES) {
      for (const [context, { context: ctx }] of Object.entries(REFERENCE_CONTEXTS)) {
        const composed = compose(ir, ctx)
        if (!composed.ok) throw new Error(`${name} is invalid`)
        const { container, unmount } = render(<FeatherExperience experience={ir} context={ctx} onReply={vi.fn()} />)
        const at = `${name} in ${context}`
        if (composed.plan.focus === null || composed.plan.manifestation !== "web") {
          expect(document.activeElement, at).toBe(document.body)
        } else {
          const host = container.querySelector(`[data-feather-node="${composed.plan.focus}"]`)
          expect(host?.contains(document.activeElement), at).toBe(true)
          expect(document.activeElement, at).not.toBe(host)
        }
        unmount()
      }
    }
  })

  it("moves once, on mount, and never when the plan changes", () => {
    const first = compose(fixture("choice-three-options"), phone)
    const second = compose(fixture("user-signup"), phone)
    if (!first.ok || !second.ok) throw new Error("invalid")
    const onReply = vi.fn()
    const { rerender } = render(<PlanView plan={first.plan} onReply={onReply} />)
    expect(document.activeElement?.closest('[data-feather-node="speed"]')).not.toBeNull()
    // The person moves on; a new plan with its own focus node must not pull them back.
    const outside = document.createElement("button")
    document.body.appendChild(outside)
    outside.focus()
    rerender(<PlanView plan={second.plan} onReply={onReply} />)
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it("autoFocus={false} leaves focus where it is", () => {
    view("choice-three-options", phone, { autoFocus: false })
    expect(document.activeElement).toBe(document.body)
  })
})

describe("voice and text plans", () => {
  failOnConsole()

  it("a voice plan renders a plain summary that includes the consequence", () => {
    const { container } = view("ad-campaign-launch", screenless)
    const root = rootOf(container)
    expect(root.getAttribute("data-manifestation")).toBe("voice")
    const summary = container.querySelector('[data-slot="experience-summary"]')!
    expect(summary).not.toBeNull()
    expect(summary.textContent).toContain("Spends AED 1,050")
    expect(summary.textContent).toContain("This cannot be undone")
    expect(summary.textContent).toContain("Recommended test: 7 days, purchase objective")
    expect(summary.textContent).toMatch(/Available: confirm, cancel/)
    expect(summary.textContent).toContain('Say "confirm"')
    // Words only: nothing to press, and a wrapper for every node.
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(container.querySelector('[data-feather-node="go"]')).not.toBeNull()
    expect(summary.getAttribute("aria-label")).toBe("Summary")
  })

  it("a text plan asks for a typed keyword", () => {
    const { container } = view("ad-campaign-launch", textOnly)
    expect(rootOf(container).getAttribute("data-manifestation")).toBe("text")
    expect(container.textContent).toContain("Spends AED 1,050")
    expect(container.textContent).toContain('Type "confirm"')
  })

  it("every fixture has a summary with a wrapper for every node, in a voice and a text plan", () => {
    for (const { name, ir } of FIXTURES) {
      for (const [label, ctx] of [["voice", screenless], ["text", textOnly]] as const) {
        const composed = compose(ir, ctx)
        if (!composed.ok) throw new Error(`${name} is invalid`)
        const { container, unmount } = render(<FeatherExperience experience={ir} context={ctx} onReply={vi.fn()} />)
        for (const node of planNodes(composed.plan)) {
          expect(container.querySelector(`[data-feather-node="${node.id}"]`), `${name} (${label}): ${node.id}`).not.toBeNull()
        }
        expect(container.querySelectorAll("button, input, textarea, a[href]"), `${name} (${label}) has nothing to operate`).toHaveLength(0)
        unmount()
      }
    }
  })

  it("a summary says the label of a predicted option, not its id", () => {
    const ir = {
      ir: "feather.ir/0",
      experience: "pick_once",
      nodes: [
        { type: "Choice", id: "c", intent: "pick one", prompt: "Which one?", reversible: false, options: [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }] },
        { type: "PredictedChoice", id: "p", intent: "predict", of: "c", option: "a", summary: "You usually pick A", confidence: 0.9 },
        { type: "IrreversibleAction", id: "go", intent: "lock it in", consequence: { statement: "The choice is final." }, confirms: "c" },
      ],
    }
    const { container } = render(<FeatherExperience experience={ir} context={screenless} onReply={vi.fn()} />)
    const summary = container.querySelector('[data-slot="experience-summary"]')!
    expect(summary.textContent).toContain("Likely: Option A, because You usually pick A.")
    expect(summary.textContent).not.toContain("Likely: a")
  })

  it("a summary names every irreversible consequence of a text-only context", () => {
    const { container } = view("arabic-delivery-confirmation", screenless)
    expect(container.textContent).toContain("سيصل المندوب ويطلب المبلغ نقدًا عند التسليم.")
    expect(rootOf(container).getAttribute("dir")).toBe("rtl")
  })
})

describe("an invalid experience", () => {
  failOnConsole()

  it("renders nothing and reports the issues", () => {
    const onIssues = vi.fn()
    const broken = { ir: "feather.ir/0", experience: "x", nodes: [{ type: "Text", id: "a", text: "hi", color: "red" }] }
    const { container } = render(<FeatherExperience experience={broken} context={phone} onReply={vi.fn()} onIssues={onIssues} />)
    expect(container.innerHTML).toBe("")
    expect(onIssues).toHaveBeenCalledTimes(1)
    expect(onIssues.mock.calls[0]![0][0].code).toBe("presentational-field")
  })

  it("does not report again when only the callback changes", () => {
    const calls: number[] = []
    const broken = { nope: true }
    const { rerender } = render(<FeatherExperience experience={broken} context={phone} onReply={vi.fn()} onIssues={() => calls.push(1)} />)
    rerender(<FeatherExperience experience={broken} context={phone} onReply={vi.fn()} onIssues={() => calls.push(2)} />)
    expect(calls).toEqual([1])
  })

  it("is not a page at all: not even for something that is not an object", () => {
    for (const bad of [null, undefined, 42, "text", []]) {
      const { container, unmount } = render(<FeatherExperience experience={bad} context={phone} onReply={vi.fn()} />)
      expect(container.innerHTML).toBe("")
      unmount()
    }
  })
})

describe("what the composer folds together", () => {
  failOnConsole()

  it("wrappers follow the plan's reading order", () => {
    for (const { name, ir } of FIXTURES) {
      for (const [context, { context: ctx }] of Object.entries(REFERENCE_CONTEXTS)) {
        const composed = compose(ir, ctx)
        if (!composed.ok) throw new Error(`${name} is invalid`)
        const { container, unmount } = render(<FeatherExperience experience={ir} context={ctx} onReply={vi.fn()} />)
        const seen = Array.from(container.querySelectorAll("[data-feather-node]"), (el) => el.getAttribute("data-feather-node")!).filter((id) => !id.startsWith("~"))
        expect(seen, `${name} in ${context}`).toEqual(composed.plan.order)
        unmount()
      }
    }
  })

  it("a prediction merged into its Choice is marked as its own node", () => {
    const { container } = view("predicted-news-topic", phone)
    const pred = container.querySelector('[data-feather-node="pred"]')!
    expect(pred.getAttribute("data-slot")).toBe("predicted-choice")
    expect(container.querySelector('[data-feather-node="category"]')!.contains(pred)).toBe(true)
  })

  it("a prediction beside an irreversible Choice is a note, and nothing is preselected", () => {
    const ir = {
      ir: "feather.ir/0",
      experience: "pick_once",
      nodes: [
        { type: "Choice", id: "c", intent: "pick one", prompt: "Which one?", reversible: false, options: [{ id: "a", label: "Option A" }, { id: "b", label: "Option B" }] },
        { type: "PredictedChoice", id: "p", intent: "predict", of: "c", option: "a", summary: "You usually pick A", confidence: 0.9 },
        { type: "IrreversibleAction", id: "go", intent: "lock it in", consequence: { statement: "The choice is final." }, confirms: "c" },
      ],
    }
    const { container } = render(<FeatherExperience experience={ir} context={phone} onReply={vi.fn()} />)
    const note = container.querySelector('[data-feather-node="p"]')!
    expect(note.getAttribute("data-organism")).toBe("PredictionNote")
    expect(note.textContent).toContain("Likely: Option A.")
    expect(note.textContent).toContain("You usually pick A")
    expect(note.querySelectorAll("button, input")).toHaveLength(0)
    for (const radio of screen.getAllByRole("radio")) expect(radio.getAttribute("aria-checked")).toBe("false")
  })

  it("with no audio output, a medium's text equivalent stands in for it", () => {
    const { container } = view("recipe-step", { device: { surface: "desktop" }, capability: { output: { audio: "unavailable" } } })
    const audio = container.querySelector('[data-feather-node="audio_guide"]')!
    expect(audio.querySelector("audio")).toBeNull()
    expect(audio.textContent).toContain("Mix two tablespoons of olive oil")
    expect(view("recipe-step", phone).container.querySelector('[data-feather-node="audio_guide"] audio')).not.toBeNull()
  })

  it("a spoken plan names the keyword in the plan's language", () => {
    const { container } = view("arabic-delivery-confirmation", screenless)
    expect(container.textContent).toContain('Say "تأكيد"')
  })
})
