import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { applyToCurrent } from "./apply.ts"

const stream = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../conformance/update/valid/streamed-trip.json"), "utf8"))

describe("applyToCurrent", () => {
  it("applies an update in order and hands back the new experience", () => {
    let current: unknown = stream.experience
    const onIssues = vi.fn()
    for (const update of stream.updates) {
      const step = applyToCurrent(current, update, onIssues)
      expect(step.result.ok).toBe(true)
      current = step.current
    }
    expect(onIssues).not.toHaveBeenCalled()
    expect((current as { revision: number }).revision).toBe(3)
    expect((current as { resolved: { summary: string } }).resolved.summary).toBe("Booked: direct flight, 9:40, 1,240 AED.")
  })

  it("does not change the experience it is given", () => {
    const before = JSON.stringify(stream.experience)
    applyToCurrent(stream.experience, stream.updates[0])
    expect(JSON.stringify(stream.experience)).toBe(before)
  })

  it("refuses a stale update: onIssues gets the issues and what is shown stays", () => {
    const onIssues = vi.fn()
    const step = applyToCurrent(stream.experience, stream.updates[1], onIssues)
    expect(step.result.ok).toBe(false)
    expect(step.current).toBe(stream.experience)
    expect(onIssues).toHaveBeenCalledOnce()
    expect(onIssues.mock.calls[0]![0].map((i: { code: string }) => i.code)).toContain("stale-revision")
  })

  it("refuses an experience that is not valid", () => {
    const onIssues = vi.fn()
    const step = applyToCurrent({ nope: true }, stream.updates[0], onIssues)
    expect(step.result.ok).toBe(false)
    expect(onIssues).toHaveBeenCalledOnce()
  })
})
