import { afterEach, describe, expect, it, vi } from "vitest"
import { createTransitions, PERSISTENT_SLOT } from "./transition"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

describe("transitions", () => {
  it("names the persistent slot", () => {
    expect(PERSISTENT_SLOT).toBe("feather-world")
  })

  it("disposes the leaving route's registrations before the update, once", async () => {
    mockMedia([])
    const order: string[] = []
    const t = createTransitions({ startViewTransition: (u: () => void | Promise<void>) => (u(), { finished: Promise.resolve(), updateCallbackDone: Promise.resolve() }) } as never)
    t.onLeave(() => order.push("dispose"))
    expect(t.pending).toBe(1)
    await t.go(() => void order.push("update"))
    expect(order).toEqual(["dispose", "update"])
    expect(t.pending).toBe(0)
  })

  it("a throwing disposer does not stop the route", async () => {
    mockMedia([])
    const t = createTransitions({} as never)
    const update = vi.fn()
    t.onLeave(() => {
      throw new Error("x")
    })
    await t.go(update)
    expect(update).toHaveBeenCalled()
  })

  it("runs the update at once without View Transitions or under reduced motion", async () => {
    const update = vi.fn()
    mockMedia([])
    await createTransitions({} as never).go(update)
    expect(update).toHaveBeenCalledTimes(1)
    mockMedia([REDUCED])
    const start = vi.fn()
    await createTransitions({ startViewTransition: start } as never).go(update)
    expect(start).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it("onLeave returns an unregister", () => {
    const t = createTransitions({} as never)
    t.onLeave(() => {})()
    expect(t.pending).toBe(0)
  })
})
