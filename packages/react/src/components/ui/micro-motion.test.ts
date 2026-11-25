import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { springFrom, toggleTransition } from "../../lib/motion"
import { Button } from "./button"
import { Checkbox } from "./checkbox"
import { FieldError, FieldSuccess } from "./field"
import { Input } from "./input"
import { Switch } from "./switch"
import { Textarea } from "./textarea"

/** The attributes of the first element in some markup whose tag is `tag`. */
function attrs(html: string, tag: string): Record<string, string> {
  const open = new RegExp(`<${tag}\\b([^>]*)>`).exec(html)?.[1] ?? ""
  return Object.fromEntries([...open.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? ""]))
}

describe("Button loading", () => {
  it("is busy, focusable and ignores presses while loading", () => {
    const a = attrs(renderToStaticMarkup(h(Button, { loading: true }, "Save")), "button")
    expect(a["aria-busy"]).toBe("true")
    expect(a["data-loading"]).toBe("true")
    expect(a["aria-disabled"]).toBe("true")
    // Still focusable: aria-disabled, never the disabled attribute.
    expect(a.disabled).toBeUndefined()
    expect(a.class).toContain("not-aria-busy:active")
    expect(a.class).toContain("data-loading:text-transparent")
  })
  it("keeps its label in the box and lays a spinner over it", () => {
    const html = renderToStaticMarkup(h(Button, { loading: true, variant: "outline" }, "Save"))
    expect(html).toContain(">Save<")
    const spinner = attrs(html, "span")
    expect(spinner["data-slot"]).toBe("button-spinner")
    expect(spinner["aria-hidden"]).toBe("true")
    expect(spinner.class).toContain("absolute inset-0")
    expect(spinner.class).toContain("text-fg-primary")
  })
  it("is an ordinary button at rest", () => {
    const html = renderToStaticMarkup(h(Button, null, "Save"))
    const a = attrs(html, "button")
    expect(a["aria-busy"]).toBeUndefined()
    expect(a["data-loading"]).toBeUndefined()
    expect(html).not.toContain("button-spinner")
    expect(a.class).toContain("active:motion-press")
  })
  it("stays disabled, not busy, when it is disabled as well", () => {
    const a = attrs(renderToStaticMarkup(h(Button, { loading: true, disabled: true }, "Save")), "button")
    expect(a.disabled).toBe("")
    expect(a["aria-busy"]).toBeUndefined()
  })
})

describe("error shake", () => {
  it.each([
    ["Input", () => renderToStaticMarkup(h(Input, { "aria-invalid": true })), "input"],
    ["Textarea", () => renderToStaticMarkup(h(Textarea, { "aria-invalid": true })), "textarea"],
  ])("%s shakes once as aria-invalid arrives", (_, render, tag) => {
    const a = attrs(render(), tag)
    expect(a["aria-invalid"]).toBe("true")
    expect(a.class).toContain("aria-invalid:motion-shake")
  })
  it("reaches the choice controls too", () => {
    expect(renderToStaticMarkup(h(Checkbox, { "aria-invalid": true, "aria-label": "Accept" }))).toContain("aria-invalid:motion-shake")
    expect(renderToStaticMarkup(h(Switch, { "aria-invalid": true, "aria-label": "Alerts" }))).toContain("aria-invalid:motion-shake")
  })
  it("announces the error text and fades it in", () => {
    const a = attrs(renderToStaticMarkup(h(FieldError, null, "Enter an email address.")), "div")
    expect(a.role).toBe("alert")
    expect(a.class).toContain("starting:opacity-0")
  })
})

describe("FieldSuccess", () => {
  it("announces the text politely, with a check that draws on", () => {
    const html = renderToStaticMarkup(h(FieldSuccess, null, "Username available"))
    const a = attrs(html, "div")
    expect(a.role).toBe("status")
    expect(a["data-slot"]).toBe("field-success")
    expect(html).toContain("Username available")
    const mark = attrs(html, "svg")
    expect(mark["data-slot"]).toBe("field-success-mark")
    expect(mark["aria-hidden"]).toBe("true")
    expect(mark.class).toContain("motion-draw")
    expect(mark.class).toContain("starting:draw-start")
  })
  it("renders nothing without a message", () => {
    expect(renderToStaticMarkup(h(FieldSuccess, null))).toBe("")
    expect(renderToStaticMarkup(h(FieldSuccess, null, ""))).toBe("")
  })
})

describe("Switch thumb", () => {
  it("rests on whole pixels, travelled by transform", () => {
    expect(renderToStaticMarkup(h(Switch, { defaultChecked: true, "aria-label": "Alerts" }))).toContain("transform:translateX(16px)")
    expect(renderToStaticMarkup(h(Switch, { defaultChecked: true, size: "sm", "aria-label": "Alerts" }))).toContain("transform:translateX(12px)")
  })
})

describe("toggle transition", () => {
  const calm = { duration: 0.24, ease: [0.4, 0, 0.2, 1] as [number, number, number, number], reduced: false }
  it("overshoots only where the brand's overshoot curve leaves [0, 1]", () => {
    expect(springFrom([0.34, 1.56, 0.64, 1], 0.2)).toEqual({ overshoot: true, bounce: 0.2 })
    expect(springFrom([0.19, 1, 0.22, 1], 0.2)).toEqual({ overshoot: false, bounce: 0 })
    expect(springFrom(undefined, 0.2)).toEqual({ overshoot: false, bounce: 0 })
  })
  it("caps the bounce at 0.25", () => {
    expect(springFrom([0.34, 1.56, 0.64, 1], 0.6).bounce).toBe(0.25)
  })
  it("is a spring in the role's duration when it overshoots, else the one curve", () => {
    expect(toggleTransition(calm, { overshoot: true, bounce: 0.15 })).toEqual({ type: "spring", visualDuration: 0.24, bounce: 0.15 })
    expect(toggleTransition(calm, { overshoot: false, bounce: 0 })).toEqual({ duration: 0.24, ease: calm.ease })
  })
  it("has no travel under reduced motion", () => {
    expect(toggleTransition({ ...calm, reduced: true }, { overshoot: true, bounce: 0.2 })).toEqual({ duration: 0 })
  })
})
