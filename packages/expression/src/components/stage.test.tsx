import { act, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
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

describe("Stage steps", () => {
  const steps = [<p key="a">Harvest</p>, <p key="b">Roast</p>, <p key="c">Brew</p>]

  it("pins the visual while one step per viewport scrolls past, and starts at step 0", async () => {
    stubMotion(false)
    const seen: Array<[number, number]> = []
    const { container } = render(<Stage steps={steps}>{(p, s) => { seen.push([p, s]); return <p>visual</p> }}</Stage>)
    await act(async () => {})
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("data-variant")).toBe("pinned")
    expect(root.getAttribute("data-step")).toBe("0")
    const frame = container.querySelector<HTMLElement>('[data-slot="stage-frame"]')!
    expect(frame.className).toContain("sticky")
    const items = container.querySelectorAll<HTMLElement>('[data-slot="stage-step"]')
    expect(items).toHaveLength(3)
    for (const item of items) expect(item.style.minHeight).toBe("100dvh")
    expect(items[0].getAttribute("data-state")).toBe("active")
    expect(items[1].getAttribute("data-state")).toBe("inactive")
    expect(seen.at(-1)?.[1]).toBe(0)
  })

  it("never pins longer than 4 viewport heights", async () => {
    stubMotion(false)
    const many = Array.from({ length: 8 }, (_, i) => <p key={i}>Step {i}</p>)
    const { container } = render(<Stage steps={many}>{() => null}</Stage>)
    await act(async () => {})
    for (const item of container.querySelectorAll<HTMLElement>('[data-slot="stage-step"]')) expect(item.style.minHeight).toBe("50dvh")
    const plain = render(<Stage length={9}>{() => null}</Stage>)
    await act(async () => {})
    expect(plain.container.querySelector<HTMLElement>('[data-slot="stage-track"]')!.style.height).toBe("400vh")
  })

  it("sets the active step from the step crossing the middle of the viewport", async () => {
    stubMotion(false)
    let callback: IntersectionObserverCallback = () => {}
    let options: IntersectionObserverInit | undefined
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
          callback = cb
          options = init
        }
        observe() {}
        disconnect() {}
      }
    )
    const seen: number[] = []
    const { container } = render(<Stage steps={steps}>{(_p, s) => { seen.push(s); return <p>visual</p> }}</Stage>)
    await act(async () => {})
    expect(options?.rootMargin).toBe("-50% 0px -50% 0px")
    const items = container.querySelectorAll('[data-slot="stage-step"]')
    act(() => callback([{ target: items[2], isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(container.firstElementChild?.getAttribute("data-step")).toBe("2")
    expect(items[2].getAttribute("data-state")).toBe("active")
    expect(seen.at(-1)).toBe(2)
  })

  it("stacks the steps in normal flow, each with its visual, under reduced motion", async () => {
    stubMotion(true)
    const seen: Array<[number, number]> = []
    const { container } = render(<Stage steps={steps}>{(p, s) => { seen.push([p, s]); return <p>visual {s}</p> }}</Stage>)
    await act(async () => {})
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("data-variant")).toBe("static")
    expect(root.getAttribute("data-step")).toBe("2")
    expect(container.querySelector(".sticky")).toBeNull()
    const items = [...container.querySelectorAll<HTMLElement>('[data-slot="stage-step"]')]
    expect(items.map((item) => item.textContent)).toEqual(["visual 0Harvest", "visual 1Roast", "visual 2Brew"])
    for (const item of items) expect(item.style.minHeight).toBe("")
    expect(seen).toEqual(expect.arrayContaining([[0, 0], [0.5, 1], [1, 2]]))
  })

  it("server-renders the stacked steps: readable in order with no script", () => {
    const html = renderToString(<Stage title={<h2>How it is made</h2>} steps={steps}>{(_p, s) => <p>visual {s}</p>}</Stage>)
    const doc = new DOMParser().parseFromString(html, "text/html")
    expect(doc.querySelector('[data-slot="stage"]')?.getAttribute("data-variant")).toBe("static")
    expect(doc.querySelector(".sticky")).toBeNull()
    expect([...doc.querySelectorAll('[data-slot="stage-step-panel"]')].map((p) => p.textContent)).toEqual(["Harvest", "Roast", "Brew"])
    expect(doc.querySelectorAll('[data-slot="stage-step-visual"]')).toHaveLength(3)
  })

  it("holds proximity snap on the page only while pinned, and gives it back", async () => {
    stubMotion(false)
    const { unmount } = render(<Stage steps={steps} snap>{() => null}</Stage>)
    await act(async () => {})
    expect(document.documentElement.style.scrollSnapType).toBe("y proximity")
    unmount()
    expect(document.documentElement.style.scrollSnapType).toBe("")
    stubMotion(true)
    render(<Stage steps={steps} snap>{() => null}</Stage>)
    await act(async () => {})
    expect(document.documentElement.style.scrollSnapType).toBe("")
  })

  it("has a data-slot on every classed element, pinned and stacked", async () => {
    for (const reduce of [false, true]) {
      stubMotion(reduce)
      const { container, unmount } = render(<Stage title="T" steps={steps}>{() => <p>v</p>}</Stage>)
      await act(async () => {})
      for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
      unmount()
    }
  })
})

