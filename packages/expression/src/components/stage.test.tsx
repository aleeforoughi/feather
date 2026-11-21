import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Stage } from "./stage"

const stubMotion = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }))
afterEach(() => vi.unstubAllGlobals())

describe("Stage", () => {
  it("sets the track height from length through inline style, and pins only the frame", async () => {
    stubMotion(false)
    const { container } = render(<Stage length={3}>{() => <p>scene</p>}</Stage>)
    await act(async () => {})
    const track = container.querySelector<HTMLElement>('[data-slot="stage-track"]')!
    const frame = container.querySelector<HTMLElement>('[data-slot="stage-frame"]')!
    expect(track.style.height).toBe("300vh")
    expect(track.className).not.toContain("sticky")
    expect(frame.className).toContain("sticky")
    expect(frame.className).toContain("h-dvh")
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe("pinned")
  })

  it("passes progress to a render prop and writes --stage-progress", async () => {
    stubMotion(false)
    const seen: number[] = []
    const { container } = render(<Stage>{(p) => { seen.push(p); return <p>scene</p> }}</Stage>)
    await act(async () => {})
    expect(seen.every((p) => p >= 0 && p <= 1)).toBe(true)
    expect(container.querySelector<HTMLElement>('[data-slot="stage-frame"]')!.style.getPropertyValue("--stage-progress")).not.toBe("")
  })

  it("renders title and caption as normal flow HTML outside the scrubbed layer", () => {
    stubMotion(false)
    const { container } = render(<Stage title={<h2>Scene title</h2>} caption="Scene caption">{() => null}</Stage>)
    expect(screen.getByRole("heading", { name: "Scene title" })).toBeTruthy()
    expect(screen.getByText("Scene caption")).toBeTruthy()
    const track = container.querySelector('[data-slot="stage-track"]')!
    expect(track.contains(screen.getByText("Scene caption"))).toBe(false)
    expect(track.contains(screen.getByRole("heading", { name: "Scene title" }))).toBe(false)
  })

  it("does not pin under reduced motion: a normal section at progress 1", async () => {
    stubMotion(true)
    const seen: number[] = []
    const { container } = render(<Stage length={4}>{(p) => { seen.push(p); return <p>scene</p> }}</Stage>)
    await act(async () => {})
    const frame = container.querySelector<HTMLElement>('[data-slot="stage-frame"]')!
    expect(frame.className).not.toContain("sticky")
    expect((container.querySelector('[data-slot="stage-track"]') as HTMLElement).style.height).toBe("")
    expect(seen.at(-1)).toBe(1)
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe("static")
  })

  it("has a data-slot on every classed element", () => {
    stubMotion(false)
    const { container } = render(<Stage title="T" caption="C">{() => null}</Stage>)
    for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
  })
})
