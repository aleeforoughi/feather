import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { defaultThemeCss } from "../scripts/default-theme.mjs"

// Feather's fallback (what a product with no brand sees) is the feather reference theme, generated, never hand-edited.
describe("the default theme", () => {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, "../css/foundation.css"), "utf8")
  it("in foundation.css is exactly themes/feather.json and themes/feather-dark.json", () => {
    expect(css).toContain(defaultThemeCss())
  })
  it("is black and white: the primary is ink, and no accent color is set", () => {
    for (const name of ["feather", "feather-dark"]) {
      const theme = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, `../themes/${name}.json`), "utf8"))
      expect(theme.tokens.colors.primary).toBe(theme.tokens.colors.text)
      expect(theme.tokens.colors.accent).toBeUndefined()
    }
  })
})
