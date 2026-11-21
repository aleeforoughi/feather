import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Block } from "../core/blocks"
import type { PreparedScene } from "../core/prepared"
import { createRegistry } from "../core/registry"
import { PreparedSceneView } from "./prepared-scene"

const registry = createRegistry({ statement: ({ block }: { block: Block }) => <p>{block.title}</p> })
const work: PreparedScene = { intent: "work", ask: "Show me the work", line: "Here it is.", blocks: [{ block: "statement", title: "Selected work" }], asks: ["Who are you?", "Unknown ask"] }
const about: PreparedScene = { intent: "about", ask: "Who are you?", line: "I design.", blocks: [{ block: "statement" }] }

describe("PreparedSceneView", () => {
  it("is a finished page: heading, line, blocks, and next asks as links to routes", () => {
    render(<PreparedSceneView scene={work} scenes={[work, about]} speaker={{ kind: "person", name: "Alee" }} registry={registry} />)
    expect(screen.getByRole("heading", { level: 1, name: "Show me the work" })).toBeTruthy()
    expect(screen.getByText("Here it is.")).toBeTruthy()
    expect(screen.getByText("Selected work")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Who are you?" }).getAttribute("href")).toBe("/about")
    expect(screen.queryByText("Unknown ask")).toBeNull()
  })
  it("uses a custom href builder and heading level", () => {
    render(<PreparedSceneView scene={work} scenes={[about]} speaker={{ kind: "company", name: "Studio" }} registry={registry} href={(i) => `/en/${i}/`} headingLevel={2} />)
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy()
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/about/")
  })
})
