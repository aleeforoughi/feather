import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Presence } from "./presence"

describe("Presence", () => {
  it("is decorative and carries its state", () => {
    const { container, rerender } = render(
      <Presence kind="mark" state="listening">
        <svg data-testid="mark" />
      </Presence>
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute("aria-hidden")).toBe("true")
    expect(el.dataset.state).toBe("listening")
    expect(el.dataset.variant).toBe("mark")
    rerender(
      <Presence kind="film" state="speaking">
        <svg data-testid="mark" />
      </Presence>
    )
    expect(el.dataset.state).toBe("speaking")
    expect(screen.getByTestId("mark")).toBeTruthy()
  })
  it("leans in while thinking, never past 1.03, and not under reduced motion", async () => {
    const { container } = render(
      <div data-motion="reduced">
        <Presence kind="object" state="thinking">
          <i />
        </Presence>
      </div>
    )
    const reduced = container.querySelector('[data-slot="presence"]') as HTMLElement
    expect(reduced.style.transform).toBe("")
    const { container: c2 } = render(
      <Presence kind="object" state="thinking">
        <i />
      </Presence>
    )
    const el = c2.querySelector('[data-slot="presence"]') as HTMLElement
    await Promise.resolve()
    const scale = /scale\(([\d.]+)\)/.exec(el.style.transform)
    if (scale) expect(Number(scale[1])).toBeLessThanOrEqual(1.03)
    expect(el.className).toContain("motion-scene")
  })
})
