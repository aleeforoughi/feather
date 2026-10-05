// The lifecycle on the web (docs/lifecycle.md section 2): the experience changes in place, and collapses to one line.
import fs from "node:fs"
import path from "node:path"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { applyUpdate, type Experience } from "@aleeforoughi/feather-intent"
import { REFERENCE_CONTEXTS } from "@aleeforoughi/feather-liquid"
import { FeatherExperience } from "./index"
import { failOnConsole } from "./test/fixtures"

const trip = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/update/valid/streamed-trip.json"), "utf8")) as { experience: Experience; updates: unknown[] }
const context = REFERENCE_CONTEXTS.phone.context

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
  const r = applyUpdate(ex, { update: "feather.update/0", experience: ex.experience, revision: (ex.revision ?? 0) + 1, ops })
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.experience
}
const view = (ex: Experience, onReply = vi.fn()) => {
  const ui = (e: Experience) => <FeatherExperience experience={e} context={context} onReply={onReply} />
  const result = render(ui(ex))
  return { ...result, show: (e: Experience) => result.rerender(ui(e)), onReply }
}
const node = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-feather-node="${id}"]`)
const live = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-slot="experience-updates"]')!

describe("a web experience that changes in place", () => {
  failOnConsole()

  it("keeps a node that survives mounted, and tells only what a person can act on, politely", () => {
    const { container, show } = view(at(0))
    expect(live(container).getAttribute("aria-live")).toBe("polite")
    const work = node(container, "work")!
    show(at(1))
    expect(node(container, "work")).toBe(work)
    expect(live(container).textContent).toBe("")
    show(at(2))
    expect(node(container, "work")).toBe(work)
    expect(live(container).textContent).toBe("New: take the recommended flight, approve the booking.")
    expect(node(container, "rec")).not.toBeNull()
    expect(node(container, "ok")).not.toBeNull()
  })

  it("starts a node over when its type changes", () => {
    const ex = at(2)
    const { container, show } = view(ex)
    const rec = node(container, "rec")!
    show(after(ex, [{ op: "replace", node: { type: "Text", id: "rec", text: "Never mind." } }]))
    expect(node(container, "rec")).not.toBe(rec)
    expect(node(container, "rec")!.getAttribute("data-organism")).not.toBe(rec.getAttribute("data-organism"))
  })

  it("never moves focus on an update, and focuses the experience root when the focused element is removed", async () => {
    const ex = at(2)
    const { container, show } = view(ex)
    const user = userEvent.setup()
    const approve = screen.getByRole("button", { name: /approve the booking|approve: book it/i })
    await user.click(approve)
    const active = document.activeElement
    expect(active).not.toBe(document.body)
    // An update that leaves the focused node alone keeps focus where it is.
    show(after(ex, [{ op: "patch", id: "work", set: { label: "Finding flights again" } }]))
    expect(document.activeElement).toBe(active)
    // One that removes it moves focus to the root, never to the body.
    const next = after(after(ex, [{ op: "patch", id: "work", set: { label: "Finding flights again" } }]), [{ op: "remove", id: "ok" }])
    show(next)
    const root = container.querySelector<HTMLElement>('[data-slot="experience"]')!
    expect(root.tabIndex).toBe(-1)
    expect(document.activeElement).toBe(root)
  })

  it("does not move focus the first time it renders onto the page when nothing had it", () => {
    const ex = at(2)
    const { show } = view(ex)
    const outside = document.createElement("button")
    document.body.append(outside)
    outside.focus()
    show(after(ex, [{ op: "patch", id: "work", set: { label: "Again" } }]))
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it("disarms an armed act whose node changed: the confirm control is gone, a polite message says so, and nothing is committed", async () => {
    const ex = at(2)
    const { container, show, onReply } = view(ex)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /^approve/i }))
    expect(container.querySelector('[data-slot="approval-confirm"]')).not.toBeNull()
    const changed = after(ex, [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }])
    show(changed)
    expect(container.querySelector('[data-slot="approval-confirm"]')).toBeNull()
    expect(container.querySelector('[data-variant="armed"]')).toBeNull()
    expect(live(container).textContent).toMatch(/approve the booking changed\. It was not confirmed/)
    expect(onReply).not.toHaveBeenCalled()
    // It has to be armed again, now with the new consequence.
    await user.click(screen.getByRole("button", { name: /^approve/i }))
    expect(onReply).not.toHaveBeenCalled()
    await user.click(container.querySelector<HTMLElement>('[data-slot="approval-confirm"]')!)
    expect(onReply).toHaveBeenCalledTimes(1)
  })

  it("disarms an armed act whose node was removed", async () => {
    const ex = at(2)
    const { container, show, onReply } = view(ex)
    await userEvent.setup().click(screen.getByRole("button", { name: /^approve/i }))
    show(after(ex, [{ op: "remove", id: "ok" }]))
    expect(container.querySelector('[data-slot="approval-confirm"]')).toBeNull()
    expect(live(container).textContent).toMatch(/approve the booking is no longer there/)
    expect(onReply).not.toHaveBeenCalled()
  })

  it("keeps an unarmed node's state when its content changes", async () => {
    const ex = at(2)
    const { container, show } = view(ex)
    const ok = node(container, "ok")!
    show(after(ex, [{ op: "patch", id: "ok", set: { consequence: { spend: { amount: 2480, currency: "AED" } } } }]))
    expect(node(container, "ok")).toBe(ok)
  })

  it("ignores a plan whose revision is not higher", () => {
    const { container, show } = view(at(2))
    show(at(1))
    expect(node(container, "ok")).not.toBeNull()
    show(at(2))
    expect(node(container, "ok")).not.toBeNull()
  })

  describe("collapsed", () => {
    const collapsed = () => at(3)

    it("is one status line: the outcome in words, the summary, the artifact link; no card and no controls", () => {
      const { container } = view(collapsed())
      const status = container.querySelector('[data-slot="experience-resolution"]')!
      expect(status.getAttribute("role")).toBe("status")
      expect(status.textContent).toContain("Done")
      expect(container.querySelector('[data-slot="experience-resolution-summary"]')!.textContent).toBe("Booked: direct flight, 9:40, 1,240 AED.")
      const link = container.querySelector<HTMLAnchorElement>('a[data-slot="experience-resolution-artifact"]')!
      expect(link.getAttribute("href")).toBe("https://example.com/booking/42")
      expect(link.textContent).toContain("Booking confirmation")
      expect(container.querySelector('[data-slot="experience-card"]')).toBeNull()
      expect(container.querySelectorAll("button, input, textarea, select")).toHaveLength(0)
      expect(container.querySelector('[data-slot="experience-regions"]')).toBeNull()
    })

    it("says Cancelled and Failed in words, and shows a non-http(s) artifact as its label only", () => {
      for (const [outcome, word] of [["cancelled", "Cancelled"], ["failed", "Failed"]] as const) {
        const ex = after(at(2), [{ op: "remove", id: "work" }, { op: "remove", id: "rec" }, { op: "remove", id: "ok" }, { op: "resolve", outcome, summary: "Nothing booked.", artifact: { label: "Receipt", href: "javascript:alert(1)" } }])
        const { container, unmount } = view(ex)
        expect(container.querySelector('[data-slot="experience-resolution"]')!.textContent).toContain(word)
        expect(container.querySelector("a")).toBeNull()
        expect(container.querySelector('[data-slot="experience-resolution-artifact"]')!.textContent).toBe("Receipt")
        unmount()
      }
    })

    it("moves focus to the summary when it collapses with focus inside, and leaves it alone otherwise", async () => {
      const ex = at(2)
      const { container, show } = view(ex)
      await userEvent.setup().click(screen.getByRole("button", { name: /^approve/i }))
      show(collapsed())
      expect(document.activeElement).toBe(container.querySelector('[data-slot="experience-resolution-summary"]'))

      const second = view(ex)
      const outside = document.createElement("button")
      document.body.append(outside)
      outside.focus()
      act(() => second.show(collapsed()))
      expect(document.activeElement).toBe(outside)
      outside.remove()
    })

    it("tells nothing is new on a collapse", () => {
      const { container, show } = view(at(2))
      show(collapsed())
      expect(live(container).textContent).toBe("")
    })
  })
})
