import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { validatePage } from "./core/validate"
import { FeatherPage } from "./render"

const themes = path.join(import.meta.dirname, "../../tokens/themes")
const examples = path.join(import.meta.dirname, "../examples")
const frozen = path.join(import.meta.dirname, "test")
const tokens = JSON.parse(fs.readFileSync(path.join(themes, "studio.json"), "utf8")).tokens

function html(file: string, dir = examples) {
  const r = validatePage(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")))
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path} ${i.code}`).join("\n"))
  const doc = document.createElement("div")
  doc.innerHTML = renderToStaticMarkup(<FeatherPage page={{ ...r.page, brand: "" }} tokens={tokens} onAsk={() => {}} />)
  return doc
}

describe("the hero's starters", () => {
  it("on a /1 page are quiet chips after the hero's one filled action", () => {
    const doc = html("studio-of-one-loud.page.json")
    const hero = doc.querySelector('[data-block="hero"]')!
    const starters = Array.from(hero.querySelectorAll('[data-slot="hero-starter"]'))
    expect(starters.length).toBeGreaterThan(0)
    for (const s of starters) expect(s.getAttribute("data-variant")).toBe("chip")
    const filled = Array.from(hero.querySelectorAll('[data-variant="primary"]'))
    expect(filled.map((f) => f.getAttribute("data-slot"))).toEqual(["hero-action"])
    // The action comes first; the chips are the secondary row after it.
    const order = Array.from(hero.querySelectorAll('[data-slot="hero-action"], [data-slot="hero-starter"]')).map((n) => n.getAttribute("data-slot"))
    expect(order[0]).toBe("hero-action")
  })

  it("on a /0 page stay as they were: the first starter filled", () => {
    const doc = html("studio-of-one-0.page.json", frozen)
    const first = doc.querySelector('[data-block="hero"] [data-slot="hero-starter"]')
    expect(first?.getAttribute("data-variant")).toBe("primary")
  })
})
