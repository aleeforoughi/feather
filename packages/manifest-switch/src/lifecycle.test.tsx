// Scanning across updates (docs/lifecycle.md section 2): rescan, keep the highlight, never start on its own, stop on collapse.
import fs from "node:fs"
import path from "node:path"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { applyUpdate, type Experience } from "@aleeforoughi/feather-intent"
import type { RenderContext } from "@aleeforoughi/feather-context"
import { FeatherSwitchExperience, type ScanClock } from "./index"
import { failOnConsole } from "./test/fixtures"

const trip = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/update/valid/streamed-trip.json"), "utf8")) as { experience: Experience; updates: unknown[] }
const context: RenderContext = { capability: { input: { switch: true } } }

function at(n: number): Experience {
  let ex = trip.experience
  for (const u of trip.updates.slice(0, n)) {
    const r = applyUpdate(ex, u)
    if (!r.ok) throw new Error(JSON.stringify(r.issues))
    ex = r.experience
  }
  return ex
}
function after(ex: Experience, ops: unknown[]): Experience {
  const r = applyUpdate(ex, { update: "feather.update/1", experience: ex.experience, revision: (ex.revision ?? 0) + 1, ops })
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.experience
}

/** A clock that only ticks when told. */
function manualClock() {
  const timers = new Map<number, () => void>()
  let id = 0
  const clock: ScanClock = {
    setTimeout: (fn) => {
      timers.set(++id, fn)
      return id
    },
    clearTimeout: (t) => void timers.delete(t as number),
    setInterval: (fn) => {
      timers.set(++id, fn)
      return id
    },
    clearInterval: (t) => void timers.delete(t as number),
  }
  return { clock, tick: () => act(() => timers.forEach((fn) => fn())), running: () => timers.size > 0 }
}

const press = (key: string) => {
  if (!document.activeElement || document.activeElement === document.body) (document.querySelector("[data-slot=switch-scanner]") as HTMLElement | null)?.focus()
  fireEvent.keyDown(document.activeElement ?? document.body, { key })
}
const scanned = () => Array.from(document.querySelectorAll<HTMLElement>("[data-scanned]"))

function mount(ex: Experience, scan: "step" | "auto" = "step", clock?: ScanClock) {
  const ui = (e: Experience) => <FeatherSwitchExperience experience={e} context={context} scan={scan} clock={clock} onReply={vi.fn()} />
  const result = render(ui(ex))
  return { ...result, show: (e: Experience) => result.rerender(ui(e)) }
}

describe("a switch over an experience that changes", () => {
  failOnConsole()
  afterEach(() => vi.useRealTimers())

  it("keeps the highlight on the same target when it is still there", () => {
    const ex = at(2)
    const { show } = mount(ex)
    for (let i = 0; i < 8 && !/^Approve: /.test(document.activeElement?.getAttribute("aria-label") ?? ""); i++) press("Tab")
    const target = document.activeElement as HTMLElement
    expect(target.getAttribute("data-scanned")).toBe("true")
    show(after(ex, [{ op: "patch", id: "work", set: { label: "Finding flights again" } }]))
    expect(document.activeElement).toBe(target)
    expect(scanned()).toHaveLength(1)
    expect(scanned()[0]).toBe(target)
  })

  it("moves the highlight to the first target when its target went away", () => {
    const ex = at(2)
    const { show } = mount(ex)
    for (let i = 0; i < 8 && !/approve/i.test(document.activeElement?.getAttribute("aria-label") ?? ""); i++) press("Tab")
    show(after(ex, [{ op: "remove", id: "ok" }]))
    const first = Array.from(document.querySelectorAll<HTMLElement>("button")).find((b) => !b.hasAttribute("disabled"))!
    expect(scanned()).toHaveLength(1)
    expect(document.activeElement).toBe(first)
  })

  it("never starts auto-scan on its own, and keeps it running once begun", () => {
    const { clock, tick, running } = manualClock()
    const ex = at(2)
    const { show } = mount(ex, "auto", clock)
    expect(running()).toBe(false)
    show(after(ex, [{ op: "patch", id: "work", set: { label: "Again" } }]))
    expect(running()).toBe(false)
    expect(scanned()).toHaveLength(0)

    press(" ") // starts scanning
    expect(running()).toBe(true)
    const first = document.activeElement
    show(after(after(ex, [{ op: "patch", id: "work", set: { label: "Again" } }]), [{ op: "patch", id: "work", set: { label: "Once more" } }]))
    expect(running()).toBe(true)
    expect(document.activeElement).toBe(first)
    tick()
    expect(document.activeElement).not.toBe(first)
  })

  it("once collapsed, the artifact link is the only target: the person can still open what the experience left", () => {
    const { container, show } = mount(at(2))
    show(at(3))
    expect(container.querySelector('[data-slot="experience-resolution"]')).not.toBeNull()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    press("Tab")
    expect(scanned().map((el) => el.getAttribute("data-slot"))).toEqual(["experience-resolution-artifact"])
    press("Tab")
    expect(scanned().map((el) => el.getAttribute("data-slot"))).toEqual(["experience-resolution-artifact"])
  })

  it("has no targets once collapsed without a link, and scanning stops", () => {
    const { clock, running } = manualClock()
    const noLink = after(at(2), [{ op: "remove", id: "work" }, { op: "remove", id: "rec" }, { op: "remove", id: "ok" }, { op: "resolve", outcome: "done", summary: "Booked." }])
    const { container, show } = mount(at(2), "auto", clock)
    press(" ")
    expect(running()).toBe(true)
    show(noLink)
    expect(running()).toBe(false)
    expect(scanned()).toHaveLength(0)
    expect(container.querySelector('[data-slot="experience-resolution"]')).not.toBeNull()
    press(" ")
    // With nothing to scan to, a press starts nothing.
    expect(running()).toBe(false)
    expect(scanned()).toHaveLength(0)
  })

  it("an armed control is no longer a target after the update disarms it", () => {
    const ex = at(2)
    const { show } = mount(ex)
    for (let i = 0; i < 8 && !/^Approve: /.test(document.activeElement?.getAttribute("aria-label") ?? ""); i++) press("Tab")
    press("Enter")
    expect(screen.getByRole("button", { name: /^Yes, approve/ })).toBeTruthy()
    show(after(ex, [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }]))
    expect(screen.queryByRole("button", { name: /^Yes, approve/ })).toBeNull()
    expect(scanned().every((el) => !/^Yes, approve/.test(el.getAttribute("aria-label") ?? ""))).toBe(true)
  })
})
