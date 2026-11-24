import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Bento, BentoCell, Grid, Split } from "./layout"

describe("Split", () => {
  it("lays two columns in the chosen ratio, stacking on mobile", () => {
    const { container } = render(<Split ratio="4:8">{["a", "b"]}</Split>)
    const root = container.querySelector('[data-slot="split"]')!
    expect(root.getAttribute("data-variant")).toBe("4:8")
    expect(root.className).toContain("grid-cols-1")
    expect(root.className).toContain("md:grid-cols-12")
    expect(container.querySelector('[data-slot="split-start"]')!.className).toContain("md:col-span-4")
    expect(container.querySelector('[data-slot="split-end"]')!.className).toContain("md:col-span-8")
  })
  it("reverse swaps the visual order but not the DOM order", () => {
    const { container } = render(<Split reverse>{["first", "second"]}</Split>)
    const [start, end] = container.querySelectorAll('[data-slot^="split-"]')
    expect(start.textContent).toBe("first")
    expect(start.className).toContain("md:order-2")
    expect(end.className).toContain("md:order-1")
    expect(container.querySelector('[data-slot="split"]')!.getAttribute("data-reverse")).toBe("true")
  })
})

describe("Grid", () => {
  it("steps columns down with the viewport", () => {
    const { container } = render(<Grid columns={4}>x</Grid>)
    const el = container.querySelector('[data-slot="grid"]')!
    expect(el.className).toContain("grid-cols-1")
    expect(el.className).toContain("lg:grid-cols-4")
    expect(el.getAttribute("data-variant")).toBe("4")
  })
})

describe("Bento", () => {
  it("is concentric: one spacing step of padding and the pad in a variable", () => {
    const { container } = render(<Bento>x</Bento>)
    const el = container.querySelector<HTMLElement>('[data-slot="bento"]')!
    expect(el.className).toContain("p-2")
    expect(el.className).toContain("rounded-concentric")
    expect(el.style.getPropertyValue("--concentric-pad")).toContain("* 2")
  })
  it("cells take span and rowSpan and use the card radius", () => {
    const { container } = render(<Bento><BentoCell span={8} rowSpan={2}>big</BentoCell><BentoCell>small</BentoCell></Bento>)
    const [big, small] = container.querySelectorAll('[data-slot="bento-cell"]')
    expect(big.className).toContain("md:col-span-8")
    expect(big.className).toContain("md:row-span-2")
    expect(big.className).toContain("rounded-card")
    expect(big.getAttribute("data-variant")).toBe("8x2")
    expect(small.className).toContain("md:col-span-4")
  })
  it("has a data-slot on every classed element", () => {
    const { container } = render(<Bento><BentoCell>a</BentoCell></Bento>)
    for (const el of container.querySelectorAll("[class]")) expect(el.getAttribute("data-slot")).toBeTruthy()
  })
})
