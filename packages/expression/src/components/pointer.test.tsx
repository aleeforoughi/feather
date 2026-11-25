import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clock } from "../core/clock"
import { PointerField } from "./pointer-field"
import { PointerTilt } from "./pointer-tilt"
import { PointerTrail } from "./pointer-trail"
import { RollText, UnderlineLink } from "./pointer-text"
import { mockMedia, REDUCED } from "../test/helpers"

beforeEach(() => document.documentElement.style.setProperty("--loudness", "3"))
afterEach(() => {
  mockMedia([])
  document.documentElement.style.removeProperty("--loudness")
})

const move = (el: Element, x: number, y: number) => act(() => void el.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true })))

describe("PointerTilt", () => {
  it("renders its children unchanged and tilts on a fine pointer", () => {
    mockMedia(["pointer: fine"])
    const { container, unmount } = render(
      <PointerTilt max={20}>
        <p>Card</p>
      </PointerTilt>,
    )
    const el = container.querySelector<HTMLElement>('[data-slot="pointer-tilt"]')!
    expect(screen.getByText("Card").parentElement).toBe(el)
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    move(el, 100, 50)
    expect(clock.size).toBe(1)
    unmount()
    expect(clock.size).toBe(0)
  })
  it("does nothing on coarse pointers, under reduced motion and below loudness 2", () => {
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "1"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const { container, unmount } = render(<PointerTilt><p>Card</p></PointerTilt>)
      const el = container.querySelector('[data-slot="pointer-tilt"]')!
      move(el, 100, 50)
      expect(clock.size).toBe(0)
      expect(screen.getByText("Card")).toBeTruthy()
      unmount()
    }
  })
})

describe("PointerField", () => {
  it("renders children unchanged and only works when allowed", () => {
    mockMedia(["pointer: fine"])
    const { container, unmount } = render(
      <PointerField>
        <span data-pointer-item>One</span>
        <span data-pointer-item>Two</span>
      </PointerField>,
    )
    const root = container.querySelector('[data-slot="pointer-field"]')!
    expect(screen.getByText("One").parentElement).toBe(root)
    unmount()
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "1"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const r = render(<PointerField><span data-pointer-item>One</span></PointerField>)
      move(r.container.querySelector('[data-slot="pointer-field"]')!, 5, 5)
      expect(clock.size).toBe(0)
      expect(r.container.querySelector<HTMLElement>("[data-pointer-item]")!.style.translate).toBe("")
      r.unmount()
    }
  })
})

describe("PointerTrail", () => {
  const imgs = Array.from({ length: 30 }, (_, i) => `/h/${i}.jpg`)
  it("caps the pool at 12 and floors it at 8, all decorative", () => {
    mockMedia(["pointer: fine"])
    const big = render(<PointerTrail images={imgs}><h1>Hero</h1></PointerTrail>)
    const nodes = big.container.querySelectorAll("img")
    expect(nodes.length).toBe(12)
    expect([...nodes].every((n) => n.getAttribute("alt") === "" && n.closest('[aria-hidden="true"]'))).toBe(true)
    expect(screen.getByText("Hero")).toBeTruthy()
    big.unmount()
    const small = render(<PointerTrail images={["/a.jpg"]}>x</PointerTrail>)
    expect(small.container.querySelectorAll("img").length).toBe(8)
    small.unmount()
    const none = render(<PointerTrail images={[]}>Only text</PointerTrail>)
    expect(none.container.querySelectorAll("img").length).toBe(0)
    expect(screen.getByText("Only text")).toBeTruthy()
  })
  it("spawns for a mouse, not for touch, reduced motion or quiet pages", () => {
    mockMedia(["pointer: fine"])
    const r = render(<PointerTrail images={imgs} spacing={50}>Hero</PointerTrail>)
    const root = r.container.querySelector<HTMLElement>('[data-slot="pointer-trail"]')!
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 }) as DOMRect
    move(root, 10, 10)
    move(root, 300, 10)
    expect(r.container.querySelectorAll("img[src]").length).toBe(2)
    r.unmount()
    for (const [media, loud] of [[[], "3"], [["pointer: fine", REDUCED], "3"], [["pointer: fine"], "2"]] as const) {
      mockMedia([...media])
      document.documentElement.style.setProperty("--loudness", loud)
      const q = render(<PointerTrail images={imgs}>Hero</PointerTrail>)
      const el = q.container.querySelector('[data-slot="pointer-trail"]')!
      move(el, 10, 10)
      move(el, 500, 10)
      expect(q.container.querySelectorAll("img[src]").length).toBe(0)
      q.unmount()
    }
  })
})

describe("text effects", () => {
  it("UnderlineLink keeps the link's name and draws a decorative line", () => {
    const { container } = render(<UnderlineLink href="/work">Selected work</UnderlineLink>)
    expect(screen.getByRole("link", { name: "Selected work" }).getAttribute("href")).toBe("/work")
    expect(container.querySelector('[data-slot="underline-link-line"]')!.getAttribute("aria-hidden")).toBe("true")
  })
  it("RollText has one accessible name and a hidden copy once motion is known", () => {
    mockMedia([])
    const { container } = render(
      <button type="button" className="group">
        <RollText>Start a project</RollText>
      </button>,
    )
    expect(screen.getByRole("button", { name: "Start a project" })).toBeTruthy()
    const copy = container.querySelector('[data-slot="roll-text-copy"]')!
    expect(copy.getAttribute("aria-hidden")).toBe("true")
    expect(copy.textContent).toBe("Start a project")
  })
  it("RollText is static under reduced motion: no second copy", () => {
    mockMedia([REDUCED])
    const { container } = render(<RollText>Start a project</RollText>)
    expect(container.querySelector('[data-slot="roll-text-copy"]')).toBeNull()
    expect(screen.getByText("Start a project")).toBeTruthy()
  })
})
