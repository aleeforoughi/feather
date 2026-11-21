import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { clock } from "../core/clock"
import { Marquee, Reel } from "./marquee"
import { mockMedia, REDUCED } from "../test/helpers"

afterEach(() => mockMedia([]))

describe("Marquee", () => {
  it("duplicates its content, hides the copy and sets the duration from the speed", () => {
    const { container } = render(<Marquee speed={100}>Hello</Marquee>)
    const root = container.querySelector('[data-slot="marquee"]')!
    expect(root.getAttribute("data-state")).toBe("playing")
    const copy = container.querySelector('[data-slot="marquee-copy"]')!
    expect(copy.getAttribute("aria-hidden")).toBe("true")
    expect(copy.hasAttribute("inert")).toBe(true)
    expect(container.querySelector('[data-slot="marquee-content"]')).not.toBeNull()
    const track = container.querySelector<HTMLElement>('[data-slot="marquee-track"]')!
    expect(track.style.animationDuration).toMatch(/s$/)
    expect(track.className).toContain("motion-marquee")
  })

  it("measures the content width / speed", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000)
    const { container } = render(<Marquee speed={50}>Hello</Marquee>)
    expect(container.querySelector<HTMLElement>('[data-slot="marquee-track"]')!.style.animationDuration).toBe("20s")
    vi.restoreAllMocks()
  })

  it("reverses for direction right", () => {
    const { container } = render(<Marquee direction="right">Hello</Marquee>)
    expect(container.querySelector<HTMLElement>('[data-slot="marquee-track"]')!.style.animationDirection).toBe("reverse")
  })

  it("has a named pause button that toggles, and pauses on hover and focus", async () => {
    const user = userEvent.setup()
    const { container } = render(<Marquee>Hello</Marquee>)
    const root = container.querySelector('[data-slot="marquee"]')!
    const track = container.querySelector<HTMLElement>('[data-slot="marquee-track"]')!
    const button = screen.getByRole("button", { name: "Pause" })
    expect(button.className).toContain("min-h-12")
    await user.click(button)
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy()
    expect(track.style.animationPlayState).toBe("paused")
    await user.click(screen.getByRole("button", { name: "Play" }))
    act(() => button.blur())
    await user.unhover(button)
    expect(root.getAttribute("data-state")).toBe("playing")
    await user.hover(root)
    expect(root.getAttribute("data-state")).toBe("paused")
    await user.unhover(root)
    act(() => button.focus())
    expect(root.getAttribute("data-state")).toBe("paused")
    act(() => button.blur())
    expect(root.getAttribute("data-state")).toBe("playing")
  })

  it("does not move under reduced motion: one static row, no copy, no pause button", () => {
    mockMedia([REDUCED])
    const { container } = render(<Marquee>Hello</Marquee>)
    expect(container.querySelector('[data-slot="marquee"]')!.getAttribute("data-state")).toBe("static")
    expect(container.querySelector('[data-slot="marquee-copy"]')).toBeNull()
    expect(container.querySelector('[data-slot="marquee-track"]')).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getAllByText("Hello")).toHaveLength(1)
  })

  it("never touches the clock", () => {
    const { unmount } = render(<Marquee>Hello</Marquee>)
    unmount()
    expect(clock.size).toBe(0)
  })
})

describe("Reel", () => {
  it("is a labelled, focusable region of snap items with buttons", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Reel aria-label="Stories">
        <p>One</p>
        <p>Two</p>
      </Reel>,
    )
    const region = screen.getByRole("region", { name: "Stories" })
    expect(region.tabIndex).toBe(0)
    expect(region.className).toContain("snap-x")
    expect(container.querySelectorAll('[data-slot="reel-item"]')).toHaveLength(2)
    const scrollBy = vi.fn()
    region.scrollBy = scrollBy
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(scrollBy.mock.calls[0]![0].left).toBeGreaterThanOrEqual(0)
    await user.click(screen.getByRole("button", { name: "Previous" }))
    expect(scrollBy).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-slot="reel"]')).not.toBeNull()
  })

  it("scrolls without smoothing under reduced motion", async () => {
    mockMedia([REDUCED])
    const user = userEvent.setup()
    render(<Reel aria-label="Stories"><p>One</p></Reel>)
    const region = screen.getByRole("region", { name: "Stories" })
    region.scrollBy = vi.fn()
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(vi.mocked(region.scrollBy).mock.calls[0]![0]).toMatchObject({ behavior: "auto" })
  })
})
