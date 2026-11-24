import fs from "node:fs"
import path from "node:path"
import { act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { validatePage } from "./core/validate"
import { mountPage } from "./mount"
import { FeatherPage } from "./render"

const page = () => {
  const r = validatePage(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../examples/studio-of-one.page.json"), "utf8")))
  if (!r.ok) throw new Error("invalid example")
  return r.page
}

describe("mountPage", () => {
  it("renders the page in a transition, re-renders and unmounts", async () => {
    const container = document.createElement("div")
    document.body.append(container)
    let mounted!: ReturnType<typeof mountPage>
    await act(async () => {
      mounted = mountPage(container, <FeatherPage page={page()} />)
    })
    expect(container.querySelectorAll("h1")).toHaveLength(1)
    expect(container.querySelector("main[data-page]")).toBeTruthy()
    await act(async () => mounted.render(<p>next</p>))
    expect(container.textContent).toBe("next")
    act(() => mounted.unmount())
    expect(container.innerHTML).toBe("")
    container.remove()
  })
})
