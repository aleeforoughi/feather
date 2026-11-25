import { afterEach, describe, expect, it, vi } from "vitest"
import { createTransitions } from "./transition"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => {
  mockMedia([])
  vi.restoreAllMocks()
})

/** A document double that records the html attribute and custom properties and lets a test finish the transition. */
function fakeDoc(withVT = true) {
  const attrs = new Map<string, string>()
  const props = new Map<string, string>()
  const listeners: Record<string, (e: unknown) => void> = {}
  let finish!: () => void
  const finished = new Promise<void>((r) => (finish = r))
  const seen: { attr?: string | null; x?: string; y?: string } = {}
  const doc = {
    documentElement: {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
      hasAttribute: (k: string) => attrs.has(k),
      style: { setProperty: (k: string, v: string) => void props.set(k, v), removeProperty: (k: string) => void props.delete(k) },
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (listeners[type] = fn),
    ...(withVT
      ? {
          startViewTransition: (u: () => void | Promise<void>) => {
            seen.attr = attrs.get("data-route-transition")
            seen.x = props.get("--route-x")
            seen.y = props.get("--route-y")
            return { finished, updateCallbackDone: Promise.resolve(u()) }
          },
        }
      : {}),
  }
  return { doc, attrs, props, listeners, finish, seen }
}

describe("slide, sheets and circle route variants", () => {
  for (const variant of ["slide", "sheets", "circle"] as const) {
    it(`${variant}: sets data-route-transition for the transition and clears it when it finishes`, async () => {
      mockMedia([])
      const f = fakeDoc()
      const update = vi.fn()
      await createTransitions(f.doc as never).go(update, { variant, arrive: false })
      expect(update).toHaveBeenCalledTimes(1)
      expect(f.seen.attr).toBe(variant)
      expect(f.attrs.get("data-route-transition")).toBe(variant)
      f.finish()
      await Promise.resolve()
      await Promise.resolve()
      expect(f.attrs.has("data-route-transition")).toBe(false)
      expect(f.props.size).toBe(0)
    })

    it(`${variant}: swaps at once under reduced motion and without View Transitions`, async () => {
      const update = vi.fn()
      mockMedia([REDUCED])
      const r = fakeDoc()
      await createTransitions(r.doc as never).go(update, { variant, arrive: false })
      expect(update).toHaveBeenCalledTimes(1)
      expect(r.attrs.size).toBe(0)
      mockMedia([])
      const n = fakeDoc(false)
      await createTransitions(n.doc as never).go(update, { variant, arrive: false })
      expect(update).toHaveBeenCalledTimes(2)
      expect(n.attrs.size).toBe(0)
    })
  }

  it("circle: opens from the last pointerdown, then clears --route-x and --route-y", async () => {
    mockMedia([])
    const f = fakeDoc()
    const t = createTransitions(f.doc as never)
    f.listeners.pointerdown({ clientX: 120, clientY: 340 })
    await t.go(() => {}, { variant: "circle", arrive: false })
    expect(f.seen.x).toBe("120px")
    expect(f.seen.y).toBe("340px")
    f.finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(f.props.size).toBe(0)
  })

  it("circle: keyboard navigation (no pointer within 1s) opens from the centre", async () => {
    mockMedia([])
    const f = fakeDoc()
    let clock = 1000
    vi.spyOn(performance, "now").mockImplementation(() => clock)
    const t = createTransitions(f.doc as never)
    await t.go(() => {}, { variant: "circle", arrive: false })
    expect([f.seen.x, f.seen.y]).toEqual(["50%", "50%"])
    f.listeners.pointerdown({ clientX: 10, clientY: 20 })
    clock += 1500
    const g = fakeDoc()
    const t2 = createTransitions(g.doc as never)
    await t2.go(() => {}, { variant: "circle", arrive: false })
    expect([g.seen.x, g.seen.y]).toEqual(["50%", "50%"])
  })

  it("the other variants never set the origin properties", async () => {
    mockMedia([])
    const f = fakeDoc()
    await createTransitions(f.doc as never).go(() => {}, { variant: "slide", arrive: false })
    expect(f.seen.x).toBeUndefined()
  })
})
