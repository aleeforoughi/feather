import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const bin = path.resolve(import.meta.dirname, "../bin/feather-brand.mjs")
const run = (cwd: string, ...args: string[]) => execFileSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" })

function product(tokens: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feather-brand-"))
  fs.mkdirSync(path.join(dir, "brand"))
  fs.writeFileSync(path.join(dir, "brand/tokens.json"), JSON.stringify(tokens))
  return dir
}
const v1 = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "golden/rich-brand.json"), "utf8"))

describe("feather-brand", () => {
  it("writes brand.css and brand-fonts.css from brand/tokens.json", () => {
    const dir = product(v1)
    expect(run(dir)).toContain("Brand theme applied")
    expect(fs.readFileSync(path.join(dir, "src/styles/brand.css"), "utf8")).toContain("--primary: #c2410c;")
    expect(fs.readFileSync(path.join(dir, "src/styles/brand-fonts.css"), "utf8")).toContain("feather-tokens/fonts/poppins.css")
  })

  it("takes a tokens path and an output directory", () => {
    const dir = product(v1)
    run(dir, "brand/tokens.json", "--out", "theme")
    expect(fs.existsSync(path.join(dir, "theme/brand.css"))).toBe(true)
  })

  it("migrates a qooe-tokens/1 file in place, schema first", () => {
    const dir = product(v1)
    expect(run(dir, "--migrate")).toContain("qooe-tokens/1 → feather-tokens/2")
    const migrated = JSON.parse(fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8"))
    expect(Object.keys(migrated)[0]).toBe("schema")
    expect(migrated).toEqual({ schema: "feather-tokens/2", ...v1 })
  })

  it("fails with every problem listed", () => {
    const dir = product({ colors: {}, typography: { fontFamily: { body: "Inter" } } })
    expect(() => run(dir)).toThrow(/colors\.primary must be a hex color/)
  })
})
