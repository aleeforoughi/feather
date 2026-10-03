// Scanning, dwell and pausing, driven only by switch presses and the pointer resting.
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { actsFor } from "@aleeforoughi/feather-intent"
import { compose } from "@aleeforoughi/feather-liquid"
import { planNodes } from "@aleeforoughi/feather-manifest-web"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { FeatherSwitchExperience } from "./index"
import { FIXTURES, failOnConsole, fixture } from "./test/fixtures"

const switchContext: RenderContext = { capability: { input: { switch: true } } }

const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key })
const focused = () => (document.activeElement as HTMLElement | null)?.textContent ?? ""
/** Presses "next" until the focused control satisfies `pred`; fails after a full lap. */
function nextUntil(pred: (el: HTMLElement) => boolean) {
  for (let i = 0; i < 40; i++) {
    press("Tab")
    if (pred(document.activeElement as HTMLElement)) return
  }
  throw new Error("never reached the target")
}

describe("step mode", () => {
  failOnConsole()
  afterEach(() => vi.useRealTimers())

  it("ad campaign: arm, then confirm, are two selections; the first emits nothing", () => {
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} scan="step" onReply={onReply} />)
    nextUntil((el) => /^Confirm spend…/.test(el.textContent ?? ""))
    const arm = document.activeElement as HTMLElement
    expect(arm.getAttribute("data-scanned")).toBe("true")
    expect(arm.closest("[data-slot=switch-scanner]")?.getAttribute("data-variant")).toBe("scanned")
    expect(arm.getAttribute("aria-describedby")).toBeTruthy()

    press("Enter")
    expect(onReply).not.toHaveBeenCalled()
    // Targets were recomputed: "Yes, confirm spend" exists now, and the highlight followed focus to it.
    expect(screen.getByRole("button", { name: "Yes, confirm spend" })).toBe(document.activeElement)
    expect((document.activeElement as HTMLElement).getAttribute("data-scanned")).toBe("true")
    expect(document.querySelectorAll("[data-scanned]").length).toBe(1)

    press("Enter")
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "confirm" })
  })

  it("Next moves through the targets in DOM order and wraps", () => {
    render(<FeatherSwitchExperience experience={fixture("choice-three-options")} context={switchContext} scan="step" onReply={vi.fn()} />)
    const host = document.querySelector("[data-slot=switch-scanner]") as HTMLElement
    // The plan may have put focus on a control already; the first press moves on from it.
    const start = document.activeElement as HTMLElement
    const seen: Element[] = []
    for (let i = 0; i < 12; i++) {
      press("Tab")
      seen.push(document.activeElement as Element)
    }
    const all = Array.from(host.querySelectorAll<HTMLElement>("button, [role=radio]")).filter((el) => !el.hasAttribute("disabled"))
    const lap = all.length
    expect(lap).toBeGreaterThan(1)
    const from = all.includes(start) ? all.indexOf(start) : -1
    seen.forEach((el, i) => expect(el).toBe(all[(from + 1 + i) % lap]))
  })

  it("keys are configurable", () => {
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} scan="step" keys={{ select: ["a"], next: ["b"] }} onReply={onReply} />)
    press("Tab")
    expect(document.querySelector("[data-scanned]")).toBeNull()
    press("b")
    expect(document.querySelector("[data-scanned]")).not.toBeNull()
  })
})

describe("auto mode", () => {
  failOnConsole()
  afterEach(() => vi.useRealTimers())

  it("does not move before the first press, then advances every scanMs, and the next press selects", () => {
    vi.useFakeTimers()
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} scan="auto" scanMs={1000} onReply={onReply} />)
    const before = document.activeElement
    act(() => void vi.advanceTimersByTime(10_000))
    expect(document.activeElement).toBe(before)
    expect(document.querySelector("[data-scanned]")).toBeNull()

    press(" ")
    const first = document.activeElement as HTMLElement
    expect(first.getAttribute("data-scanned")).toBe("true")
    expect(onReply).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(999))
    expect(document.activeElement).toBe(first)
    act(() => void vi.advanceTimersByTime(1))
    const second = document.activeElement as HTMLElement
    expect(second).not.toBe(first)
    expect(first.hasAttribute("data-scanned")).toBe(false)
    expect(second.getAttribute("data-scanned")).toBe("true")
    act(() => void vi.advanceTimersByTime(1000))
    expect(document.activeElement).not.toBe(second)

    // A press selects whatever is highlighted.
    const target = document.activeElement as HTMLElement
    const click = vi.fn()
    target.addEventListener("click", click)
    press("Enter")
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("wraps at the end", () => {
    vi.useFakeTimers()
    render(<FeatherSwitchExperience experience={fixture("choice-three-options")} context={switchContext} scan="auto" scanMs={100} onReply={vi.fn()} />)
    press(" ")
    const first = document.activeElement
    const seen = new Set<Element | null>([first])
    for (let i = 0; i < 20 && !(i > 0 && document.activeElement === first); i++) {
      act(() => void vi.advanceTimersByTime(100))
      seen.add(document.activeElement)
    }
    expect(document.activeElement).toBe(first)
    expect(seen.size).toBeGreaterThan(1)
  })

  it("completes the ad campaign spend with one switch: arm, then confirm", () => {
    vi.useFakeTimers()
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} scan="auto" scanMs={1000} onReply={onReply} />)
    press(" ")
    for (let i = 0; i < 20 && !/^Confirm spend…/.test(focused()); i++) act(() => void vi.advanceTimersByTime(1000))
    press(" ")
    expect(onReply).not.toHaveBeenCalled()
    expect(focused()).toBe("Yes, confirm spend")
    press(" ")
    expect(onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "go", act: "confirm" })
  })

  it("stops scanning when no targets remain", () => {
    vi.useFakeTimers()
    render(<FeatherSwitchExperience experience={fixture("text-only")} context={switchContext} scan="auto" scanMs={100} onReply={vi.fn()} />)
    press(" ")
    act(() => void vi.advanceTimersByTime(1000))
    expect(document.querySelector("[data-scanned]")).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe("dwell", () => {
  failOnConsole()
  afterEach(() => vi.useRealTimers())

  it("selects an ordinary button after dwellMs, and not before", () => {
    vi.useFakeTimers()
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} dwellMs={800} onReply={onReply} />)
    const accept = screen.getByRole("button", { name: /^Accept recommendation/ })
    fireEvent.pointerEnter(accept)
    act(() => void vi.advanceTimersByTime(799))
    expect(onReply).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onReply).toHaveBeenCalledWith({ experience: "approve_campaign", node: "rec", act: "accept" })
  })

  it("leaving before dwellMs selects nothing", () => {
    vi.useFakeTimers()
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} dwellMs={800} onReply={onReply} />)
    const accept = screen.getByRole("button", { name: /^Accept recommendation/ })
    fireEvent.pointerEnter(accept)
    act(() => void vi.advanceTimersByTime(400))
    fireEvent.pointerLeave(accept)
    act(() => void vi.advanceTimersByTime(2000))
    expect(onReply).not.toHaveBeenCalled()
  })

  it("may arm an irreversible act, but never commits it", () => {
    vi.useFakeTimers()
    const onReply = vi.fn()
    render(<FeatherSwitchExperience experience={fixture("ad-campaign-launch")} context={switchContext} dwellMs={500} onReply={onReply} />)
    fireEvent.pointerEnter(screen.getByRole("button", { name: /^Confirm spend…/ }))
    act(() => void vi.advanceTimersByTime(500))
    const confirm = screen.getByRole("button", { name: "Yes, confirm spend" })
    expect(onReply).not.toHaveBeenCalled()
    expect(confirm.getAttribute("data-slot")).toMatch(/-confirm$/)

    fireEvent.pointerEnter(confirm)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(onReply).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Yes, confirm spend" })).not.toBeNull()
    // The switch itself commits.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Enter" })
  })
})

describe("text fields", () => {
  failOnConsole()
  afterEach(() => vi.useRealTimers())

  it("pause scanning while focused; Escape resumes", () => {
    vi.useFakeTimers()
    render(<FeatherSwitchExperience experience={fixture("newsletter-signup")} context={switchContext} scan="auto" scanMs={100} onReply={vi.fn()} />)
    const scanner = document.querySelector("[data-slot=switch-scanner]") as HTMLElement
    press(" ")
    // Scan until the email field is highlighted: focus puts the scanner on pause.
    for (let i = 0; i < 20 && !(document.activeElement instanceof HTMLInputElement); i++) act(() => void vi.advanceTimersByTime(100))
    const field = document.activeElement as HTMLInputElement
    expect(field).toBeInstanceOf(HTMLInputElement)
    expect(scanner.getAttribute("data-variant")).toBe("paused")
    act(() => void vi.advanceTimersByTime(5000))
    expect(document.activeElement).toBe(field)
    // The press that would select goes to the field: space is typed, not taken.
    const space = fireEvent.keyDown(field, { key: " " })
    expect(space).toBe(true)

    fireEvent.keyDown(field, { key: "Escape" })
    expect(scanner.getAttribute("data-variant")).not.toBe("paused")
    act(() => void vi.advanceTimersByTime(100))
    expect(document.activeElement).not.toBe(field)
  })
})

describe("every valid fixture", () => {
  failOnConsole()
  for (const { name, ir } of FIXTURES) {
    it(`${name} renders and has a target when it has an act`, () => {
      const result = compose(ir, switchContext)
      expect(result.ok).toBe(true)
      const { container } = render(<FeatherSwitchExperience experience={ir} context={switchContext} scan="step" onReply={vi.fn()} />)
      expect(container.querySelector("[data-slot=switch-scanner]")).not.toBeNull()
      if (result.ok) {
        const hasAct = planNodes(result.plan).some((n) => n.node && actsFor(n.node).length > 0)
        expect(container.querySelector("[data-manifestation]")?.getAttribute("data-manifestation")).toBe(result.plan.manifestation)
        press("Tab")
        if (hasAct) expect(container.querySelector("[data-scanned=true]"), "an act needs a target").not.toBeNull()
      }
    })
  }
})
