import fs from "node:fs"
import path from "node:path"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { validatePage } from "./core/validate"
import { FeatherPage, PageNotFound, PreparedPage, pageScenes } from "./render"
import type { PageDocument } from "./core/types"

const themes = path.join(import.meta.dirname, "../../tokens/themes")
const theme = (name: string) => JSON.parse(fs.readFileSync(path.join(themes, `${name}.json`), "utf8")).tokens
const doc = (): PageDocument => {
  const r = validatePage(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../examples/studio-of-one.page.json"), "utf8")))
  if (!r.ok) throw new Error("invalid example")
  return r.page
}

describe("FeatherPage", () => {
  it("renders the whole base page, readable with the model off", () => {
    render(<FeatherPage page={doc()} tokens={theme("portrait")} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "Selected work" })).toBeTruthy()
    expect(screen.getByText(/An AI agent answering in Alee/)).toBeTruthy()
  })

  it("restyles entirely from the brand: the same page, three themes", () => {
    const css = ["studio", "portrait", "seed"].map((b) => {
      const html = renderToStaticMarkup(<FeatherPage page={doc()} tokens={theme(b)} />)
      return /<style data-feather-theme="">([\s\S]*?)<\/style>/.exec(html)?.[1] ?? ""
    })
    expect(new Set(css).size).toBe(3)
    const bodies = ["studio", "portrait", "seed"].map((b) => renderToStaticMarkup(<FeatherPage page={doc()} tokens={theme(b)} />).replace(/<style[\s\S]*?<\/style>/, ""))
    expect(new Set(bodies).size).toBe(1)
  })

  it("plays a prepared scene when a hero starter is pressed, after the section in view", async () => {
    render(<FeatherPage page={doc()} tokens={theme("seed")} />)
    await act(async () => {
      await userEvent.click(screen.getAllByRole("button", { name: "Show me the work" })[0])
    })
    expect(await screen.findByText(/Passwordless sign-in for 2 million people/)).toBeTruthy()
    expect(screen.getByRole("article", { name: "Show me the work" })).toBeTruthy()
  })

  it("refuses a brand that does not compile", () => {
    expect(() => render(<FeatherPage page={doc()} tokens={{ colors: {} } as never} />)).toThrow(/does not compile/)
  })

  it("renders a page without a living layer as a plain site", () => {
    const { living: _l, ...page } = doc()
    void _l
    render(<FeatherPage page={page as PageDocument} tokens={theme("studio")} />)
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})

describe("PreparedPage", () => {
  it("is a static route with the ask as its heading, readable with no script", () => {
    const html = renderToStaticMarkup(<PreparedPage page={doc()} intent="hire" tokens={theme("portrait")} />)
    expect(html).toContain("Can I hire you?")
    expect(html).toContain("Yes, from January.")
    expect(html).toContain('data-intent="hire"')
  })

  it("lists only the prepared scenes", () => {
    expect(pageScenes(doc()).map((s) => s.intent)).toEqual(["work", "hire", "now", "contact"])
    expect(() => renderToStaticMarkup(<PreparedPage page={doc()} intent="pricing" />)).toThrow(/not a prepared scene/)
  })
})

describe("the page edges (feather.page/1)", () => {
  it("renders a page without edges exactly as /0 did: no header, no footer, no loader", () => {
    const { nav, footer, notFound, transition, ...plain } = doc()
    void [nav, footer, notFound, transition]
    const html = renderToStaticMarkup(<FeatherPage page={{ ...plain, schema: "feather.page/0" }} tokens={theme("studio")} />)
    expect(html).not.toContain('data-slot="overlay-menu"')
    expect(html).not.toContain('data-slot="page-footer"')
    expect(html).not.toContain('data-slot="loader"')
  })

  it("puts the nav before main and the footer after it, every link in the HTML", () => {
    const html = renderToStaticMarkup(<FeatherPage page={doc()} tokens={theme("seed")} />)
    const nav = html.indexOf('data-slot="overlay-menu"')
    const main = html.indexOf("<main")
    const footer = html.indexOf('data-slot="page-footer"')
    expect(nav).toBeGreaterThan(-1)
    expect(nav).toBeLessThan(main)
    expect(footer).toBeGreaterThan(main)
    for (const item of doc().nav!.items) expect(html).toContain(`href="${item.href}"`)
  })

  it("renders the loader in the HTML only when the page asks for one, hidden without script and under reduced motion", () => {
    const html = renderToStaticMarkup(<FeatherPage page={{ ...doc(), loader: { variant: "dock" } }} tokens={theme("portrait")} />)
    expect(html).toMatch(/data-slot="loader"[^>]*/)
    expect(html).toContain("noscript:hidden")
    expect(html).toContain("motion-reduce:hidden")
  })

  it("serves the 404 with one h1 and the way home, in the page's chrome", () => {
    render(<PageNotFound page={doc()} tokens={theme("studio")} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This page went somewhere else")
    expect(screen.getByRole("link", { name: "Back to the work" }).getAttribute("href")).toBe("/")
    expect(document.querySelector('[data-slot="loader"]')).toBeNull()
  })
})
