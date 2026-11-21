import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Section } from "./section"

describe("Section", () => {
  it("is a labelled region with the page grid and its rhythm", () => {
    render(
      <Section aria-labelledby="t" space="l" tone="subtle">
        <h2 id="t">Work</h2>
      </Section>
    )
    const region = screen.getByRole("region", { name: "Work" })
    expect(region.dataset.slot).toBe("section")
    expect(region.dataset.variant).toBe("subtle")
    expect(region.className).toContain("section-space-l")
    expect(region.querySelector('[data-slot="section-content"]')?.className).toContain("page-grid")
  })

  it("shows its content at once without IntersectionObserver (HTML first)", () => {
    render(
      <Section aria-label="Contact">
        <p>Write to me</p>
      </Section>
    )
    const content = screen.getByText("Write to me").parentElement as HTMLElement
    expect(content.style.opacity).toBe("")
  })

  it("renders as another landmark when asked", () => {
    render(<Section as="footer">x</Section>)
    expect(screen.getByRole("contentinfo")).toBeTruthy()
  })
})
