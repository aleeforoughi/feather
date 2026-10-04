import { describe, expect, it } from "vitest"
import { autocompleteFor, checkForm, checkFormField, fieldHint, formSections, formStatusText, type FormGroupField } from "./form-group"

const f = (over: Partial<FormGroupField> & Pick<FormGroupField, "kind">): FormGroupField => ({ id: "x", prompt: "X", ...over })

describe("checkFormField", () => {
  it("leaves an empty optional field out, and refuses an empty required one", () => {
    expect(checkFormField(f({ kind: "text" }), "   ")).toEqual({ ok: true, value: undefined })
    expect(checkFormField(f({ kind: "text", required: true }), "")).toEqual({ ok: false, message: "This is required." })
  })
  it("trims text", () => {
    expect(checkFormField(f({ kind: "text" }), "  Sundays ")).toEqual({ ok: true, value: "Sundays" })
  })
  it("parses numbers and respects min and max", () => {
    const money = f({ kind: "money", currency: "AED", min: 0, max: 100 })
    expect(checkFormField(money, "12.5")).toEqual({ ok: true, value: 12.5 })
    expect(checkFormField(money, "-1").ok).toBe(false)
    expect(checkFormField(money, "101").ok).toBe(false)
    expect(checkFormField(money, "abc").ok).toBe(false)
    expect(checkFormField(money, "0x10").ok).toBe(false)
    expect(checkFormField(money, "", true).ok).toBe(false)
  })
  it("keeps a date as an ISO string and refuses a day that does not exist", () => {
    expect(checkFormField(f({ kind: "date" }), "2026-03-14")).toEqual({ ok: true, value: "2026-03-14" })
    expect(checkFormField(f({ kind: "date" }), "2026-02-30").ok).toBe(false)
    expect(checkFormField(f({ kind: "date" }), "next week").ok).toBe(false)
  })
  it("checks email, phone, url and length", () => {
    expect(checkFormField(f({ kind: "email" }), "a@b.co").ok).toBe(true)
    expect(checkFormField(f({ kind: "email" }), "nope").ok).toBe(false)
    expect(checkFormField(f({ kind: "phone" }), "+971 4 123 4567").ok).toBe(true)
    expect(checkFormField(f({ kind: "phone" }), "call me").ok).toBe(false)
    expect(checkFormField(f({ kind: "url" }), "https://example.com").ok).toBe(true)
    expect(checkFormField(f({ kind: "url" }), "example").ok).toBe(false)
    expect(checkFormField(f({ kind: "text", maxLength: 3 }), "abcd").ok).toBe(false)
    expect(checkFormField(f({ kind: "text", maxLength: 3 }), "😀😀😀").ok).toBe(true)
  })
})

describe("checkForm", () => {
  const fields: FormGroupField[] = [
    { id: "a", prompt: "A", kind: "text" },
    { id: "b", prompt: "B", kind: "number" },
    { id: "c", prompt: "C", kind: "email", required: true },
  ]
  it("sends only the answered fields", () => {
    const r = checkForm(fields, { a: "", b: "3", c: "a@b.co" })
    expect(r.answers).toEqual({ b: 3, c: "a@b.co" })
    expect(r.problems).toEqual({})
    expect(r.empty).toBe(false)
  })
  it("names every problem and the first invalid field", () => {
    const r = checkForm(fields, { a: "", b: "x", c: "" })
    expect(Object.keys(r.problems)).toEqual(["b", "c"])
    expect(r.firstInvalid).toBe("b")
  })
  it("is empty when nothing is answered and nothing is wrong", () => {
    expect(checkForm(fields.slice(0, 2), { a: " ", b: "" }).empty).toBe(true)
  })
})

describe("formSections", () => {
  it("groups consecutive fields with the same group, and keeps ungrouped runs apart", () => {
    const runs = formSections([
      { id: "1", prompt: "1", kind: "text", group: "G" },
      { id: "2", prompt: "2", kind: "text", group: "G" },
      { id: "3", prompt: "3", kind: "text" },
      { id: "4", prompt: "4", kind: "text", group: "G" },
    ])
    expect(runs.map((r) => [r.group, r.fields.map((x) => x.id)])).toEqual([["G", ["1", "2"]], [undefined, ["3"]], ["G", ["4"]]])
  })
})

describe("words", () => {
  it("autocomplete hints", () => {
    expect(autocompleteFor({ id: "contact", kind: "email" })).toBe("email")
    expect(autocompleteFor({ id: "phone", kind: "phone" })).toBe("tel")
    expect(autocompleteFor({ id: "city", kind: "text" })).toBe("address-level2")
    expect(autocompleteFor({ id: "notes", kind: "text" })).toBe("off")
  })
  it("hints name the currency and the range", () => {
    expect(fieldHint(f({ kind: "money", currency: "AED", min: 0 }))).toBe("Amount in AED. 0 or more.")
    expect(fieldHint(f({ kind: "text", maxLength: 200 }))).toBe("Up to 200 characters.")
  })
  it("status", () => {
    expect(formStatusText("sent", 1)).toBe("Sent. 1 answer was sent.")
    expect(formStatusText("invalid", 2)).toBe("Not sent. 2 answers need fixing.")
  })
})
