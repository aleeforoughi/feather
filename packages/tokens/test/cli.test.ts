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
    expect(run(dir, "--migrate")).toContain("qooe-tokens/1 → feather-tokens/3")
    const migrated = JSON.parse(fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8"))
    expect(Object.keys(migrated)[0]).toBe("schema")
    expect(migrated).toEqual({ schema: "feather-tokens/3", ...v1, pace: v1.motion, focus: "primary" })
  })

  it("leaves a /3 file /3 on a plain --migrate, and upgrades it to /4 only with --to 4", () => {
    const v3 = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "golden/v3-brands.json"), "utf8")).portrait
    const dir = product(v3)
    expect(run(dir, "--migrate")).toContain("feather-tokens/3 → feather-tokens/3")
    expect(JSON.parse(fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8"))).toEqual(v3)
    expect(run(dir, "--migrate", "--to", "4")).toContain("feather-tokens/3 → feather-tokens/4")
    expect(JSON.parse(fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8"))).toEqual({ ...v3, schema: "feather-tokens/4" })
    // The upgraded file themes, with the /4 roles.
    run(dir)
    expect(fs.readFileSync(path.join(dir, "src/styles/brand.css"), "utf8")).toContain("--loudness: 1;")
  })

  it("refuses a --to 4 that would not theme, a downgrade and an unknown target, and leaves the file alone", () => {
    const broken = { schema: "feather-tokens/3", colors: { primary: "#336699" }, typography: { fontFamily: { body: "Inter" } } }
    const dir = product(broken)
    const before = fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8")
    expect(() => run(dir, "--migrate", "--to", "4")).toThrow(/Migration refused[\s\S]*colors\.background must be a hex color/)
    expect(fs.readFileSync(path.join(dir, "brand/tokens.json"), "utf8")).toBe(before)
    const v4 = product({ ...v1, schema: "feather-tokens/4" })
    expect(() => run(v4, "--migrate", "--to", "3")).toThrow(/cannot migrate feather-tokens\/4 down to feather-tokens\/3/)
    expect(() => run(v4, "--migrate", "--to", "9")).toThrow(/cannot migrate to "feather-tokens\/9"/)
    expect(() => run(v4, "--to", "4")).toThrow(/--to names the schema a --migrate moves to/)
  })

  it("fails with every problem listed", () => {
    const dir = product({ colors: {}, typography: { fontFamily: { body: "Inter" } } })
    expect(() => run(dir)).toThrow(/colors\.primary must be a hex color/)
  })
})
