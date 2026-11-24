import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { OverlayMenu } from "./overlay-menu"
import { mockMedia, REDUCED } from "../test/helpers"

const items = [
  { label: "Work", href: "/work", current: true },
  { label: "Studio", href: "/studio" },
  { label: "Contact", href: "/contact" },
]

const setup = () =>
  render(
    <div>
      <main data-testid="page">
        <a href="/outside">Outside</a>
      </main>
      <OverlayMenu items={items} brand={<a href="/">Home</a>} aside={<a href="mailto:a@b.c">Mail</a>} />
    </div>,
  )

afterEach(() => {
  mockMedia([])
  document.documentElement.style.overflow = ""
})

describe("OverlayMenu", () => {
  it("server-renders every link, with the toggle and panel wired", () => {
    const html = renderToStaticMarkup(<OverlayMenu items={items} />)
    for (const item of items) expect(html).toContain(`href="${item.href}"`)
    expect(html).toContain('data-loader-dock=""')
    expect(html).toContain("noscript:hidden")
    expect(html).toContain('aria-expanded="false"')
  })

  it("marks the current page", () => {
    setup()
    expect(screen.getByText("Work", { selector: "a" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByText("Studio", { selector: "a" }).hasAttribute("aria-current")).toBe(false)
  })

  it("opens as a modal dialog, focuses the first link, locks the page", async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole("button", { name: "Menu" })
    await user.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(toggle.textContent).toContain("Close")
    expect(document.activeElement).toBe(screen.getByText("Work", { selector: "a" }))
    const dialog = document.querySelector('[data-slot="overlay-menu-panel"]')!
    expect(dialog.getAttribute("role")).toBe("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.getAttribute("data-state")).toBe("open")
    expect(screen.getByTestId("page").hasAttribute("inert")).toBe(true)
    expect(document.documentElement.style.overflow).toBe("hidden")
  })

  it("keeps Tab and Shift+Tab inside the open menu, bar included, in reading order", async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole("button", { name: "Menu" })
    const home = screen.getByText("Home")
    await user.click(toggle)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(toggle)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(home)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByText("Mail"))
    await user.tab()
    expect(document.activeElement).toBe(home)
    await user.tab()
    expect(document.activeElement).toBe(toggle)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByText("Work", { selector: "a" }))
  })

  it("closes on Escape, returns focus to the toggle and restores the page", async () => {
    const user = userEvent.setup()
    document.documentElement.style.overflow = "scroll"
    setup()
    const toggle = screen.getByRole("button", { name: "Menu" })
    await user.click(toggle)
    await user.keyboard("{Escape}")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(toggle)
    expect(screen.getByTestId("page").hasAttribute("inert")).toBe(false)
    expect(document.documentElement.style.overflow).toBe("scroll")
    expect(document.querySelector('[data-slot="overlay-menu-panel"]')!.hasAttribute("role")).toBe(false)
  })

  it("leaves a pre-existing inert alone", async () => {
    const user = userEvent.setup()
    const { getByTestId } = setup()
    getByTestId("page").setAttribute("inert", "")
    await user.click(screen.getByRole("button", { name: "Menu" }))
    await user.keyboard("{Escape}")
    expect(getByTestId("page").hasAttribute("inert")).toBe(true)
  })

  it("closes when a link is chosen", async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole("button", { name: "Menu" })
    await user.click(toggle)
    await user.click(screen.getByText("Studio", { selector: "a" }))
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
  })

  it("still opens and closes under reduced motion", async () => {
    mockMedia([REDUCED])
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole("button", { name: "Menu" })
    await user.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    await user.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(toggle)
  })
})
