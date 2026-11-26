// The feather-page CLI on the built package (run `pnpm build` first, as CI does). A static build has no runtime, so
// it must never write the loader into its pages: nothing would mount it and it would hold at 0%.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "..")
const tmpBase = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : path.join(root, "node_modules", ".cache")
fs.mkdirSync(tmpBase, { recursive: true })
const work = fs.mkdtempSync(path.join(tmpBase, "feather-page-cli-"))
afterAll(() => fs.rmSync(work, { recursive: true, force: true }))

function build(extra: Record<string, unknown>, flags: string[] = []) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, "examples/studio-of-one.page.json"), "utf8"))
  const theme = JSON.parse(fs.readFileSync(path.join(root, "../tokens/themes/studio.json"), "utf8"))
  const dir = fs.mkdtempSync(path.join(work, "site-"))
  fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify(theme))
  fs.writeFileSync(path.join(dir, "page.json"), JSON.stringify({ ...doc, brand: "brand.json", ...extra }))
  if (!fs.existsSync(path.join(root, "dist/index.js"))) throw new Error("build the package first (pnpm build)")
  execFileSync(process.execPath, [path.join(root, "bin/feather-page.mjs"), "build", path.join(dir, "page.json"), "--out", path.join(dir, "out"), ...flags], { stdio: "pipe" })
  const out = path.join(dir, "out")
  const files = fs.readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith(".html"))
  return files.map((f) => ({ file: f, html: fs.readFileSync(path.join(out, f), "utf8") }))
}

describe("feather-page build", () => {
  it("never writes the loader into the static pages", () => {
    const pages = build({ loader: { variant: "counter", label: "Loading" }, notFound: { variant: "type" } })
    expect(pages.map((p) => p.file).sort()).toEqual(expect.arrayContaining(["index.html", "404.html", path.join("work", "index.html")]))
    for (const p of pages) expect(p.html, p.file).not.toContain('data-slot="loader"')
  })

  it("writes the page's loudness and the knobs' markup into the static base page", () => {
    const [index] = build({ loudness: 2 }).filter((p) => p.file === "index.html")
    expect(index.html).toMatch(/<main data-page="" data-loudness="2"/)
    expect(index.html.match(/<h1[\s>]/g)).toHaveLength(1)
  })

  it("with --runtime, each page carries its document and brand and the runtime, and the base page keeps its loader", () => {
    const pages = build({ loader: { variant: "dock", label: "Loading" }, notFound: { variant: "type" } }, ["--runtime", "/feather-page-runtime.js"])
    for (const p of pages) {
      expect(p.html, p.file).toContain("<div data-feather-page-root>")
      expect(p.html, p.file).toContain('<script type="module" src="/feather-page-runtime.js"></script>')
      const data = /<script type="application\/json" data-feather-page>([\s\S]*?)<\/script>/.exec(p.html)?.[1]
      expect(data, p.file).toBeDefined()
      expect(data, p.file).not.toContain("<")
      const parsed = JSON.parse(data!)
      expect(parsed.page.schema, p.file).toBe("feather.page/1")
      expect(parsed.tokens, p.file).toBeDefined()
    }
    const byFile = Object.fromEntries(pages.map((p) => [p.file, p.html]))
    expect(byFile["index.html"]).toContain('data-slot="loader"')
    expect(byFile["404.html"]).not.toContain('data-slot="loader"')
    expect(byFile["404.html"]).toContain('"notFound":true')
    expect(byFile[path.join("work", "index.html")]).toContain('"intent":"work"')
  })

  it("with a scheme, sets a remembered choice in the head before anything paints, and writes both sets", () => {
    const scheme = { colors: { background: "#F6F1EA", surface: "#FFFFFF", text: "#1C130C", primary: "#1C130C", primaryText: "#FFFFFF" } }
    for (const p of build({ scheme })) {
      const head = p.html.slice(0, p.html.indexOf("</head>"))
      expect(head, p.file).toMatch(/<script>try\{var s=localStorage\.getItem\("feather-scheme"\)/)
      expect(head.indexOf("<script>"), p.file).toBeLessThan(head.indexOf("<title>"))
      expect(p.html, p.file).toContain('<style data-feather-scheme="">')
    }
    for (const p of build({})) expect(p.html, p.file).not.toContain("feather-scheme")
  })
})

const bin = path.join(root, "bin/feather-page.mjs")
/** Runs the CLI in a folder, returning its exit code and output (never throwing on a non-zero exit). */
function cli(cwd: string, args: string[]) {
  try {
    const stdout = execFileSync(process.execPath, [bin, ...args], { cwd, stdio: "pipe", encoding: "utf8" })
    return { code: 0, stdout, stderr: "" }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { code: err.status, stdout: String(err.stdout), stderr: String(err.stderr) }
  }
}
const NAMES = ["launch", "studio", "editorial", "service", "product", "creator"]

describe("feather-page init", () => {
  it("--list lists the six templates with a line each", () => {
    const r = cli(work, ["init", "--list"])
    expect(r.code).toBe(0)
    for (const name of NAMES) expect(r.stdout).toMatch(new RegExp(`^  ${name}\\s+\\S.+$`, "m"))
  })

  it("an unknown template exits non-zero with the list", () => {
    const r = cli(work, ["init", "portfolio"])
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('there is no template "portfolio"')
    for (const name of NAMES) expect(r.stderr).toContain(name)
    const none = cli(work, ["init"])
    expect(none.code).toBe(2)
    expect(none.stderr).toContain("launch")
  })

  it("writes the template's document, valid, to <name>.page.json or --out", () => {
    const dir = fs.mkdtempSync(path.join(work, "init-"))
    const r = cli(dir, ["init", "studio"])
    expect(r.code, r.stderr).toBe(0)
    const doc = JSON.parse(fs.readFileSync(path.join(dir, "studio.page.json"), "utf8"))
    expect(doc).toEqual(JSON.parse(fs.readFileSync(path.join(root, "templates/studio.page.json"), "utf8")))
    expect(r.stdout).toContain("--theme")
    expect(cli(dir, ["validate", "studio.page.json"]).code).toBe(0)
    expect(cli(dir, ["init", "launch", "--out", "site/page.json"]).code).toBe(0)
    expect(fs.existsSync(path.join(dir, "site/page.json"))).toBe(true)
  })

  it("never overwrites a file without --force", () => {
    const dir = fs.mkdtempSync(path.join(work, "init-"))
    fs.writeFileSync(path.join(dir, "page.json"), "mine")
    const r = cli(dir, ["init", "editorial", "--out", "page.json"])
    expect(r.code).toBe(1)
    expect(r.stderr).toContain("--force")
    expect(fs.readFileSync(path.join(dir, "page.json"), "utf8")).toBe("mine")
    expect(cli(dir, ["init", "editorial", "--out", "page.json", "--force"]).code).toBe(0)
    expect(JSON.parse(fs.readFileSync(path.join(dir, "page.json"), "utf8")).layout).toBe("editorial")
  })

  it("with --theme, every template builds in the brand as it is written: brand points at the theme, a scheme gets its other set", () => {
    const dir = fs.mkdtempSync(path.join(work, "init-"))
    fs.mkdirSync(path.join(dir, "themes"))
    fs.copyFileSync(path.join(root, "../tokens/themes/portrait.json"), path.join(dir, "themes/portrait.json"))
    for (const name of NAMES) {
      const r = cli(dir, ["init", name, "--out", `pages/${name}.json`, "--theme", "themes/portrait.json"])
      expect(r.code, r.stderr).toBe(0)
      const doc = JSON.parse(fs.readFileSync(path.join(dir, `pages/${name}.json`), "utf8"))
      expect(doc.brand).toBe("../themes/portrait.json")
      if (doc.scheme) expect(doc.scheme.colors.background.toLowerCase()).toBe("#241f21")
      const built = cli(dir, ["build", `pages/${name}.json`, "--out", `out/${name}`])
      expect(built.code, built.stderr).toBe(0)
      const index = fs.readFileSync(path.join(dir, `out/${name}/index.html`), "utf8")
      expect(index, name).toContain(`data-layout="${doc.layout}"`)
      expect(index.match(/<h1[\s>]/g), name).toHaveLength(1)
    }
    expect(cli(dir, ["init", "launch", "--theme", "themes/missing.json"]).code).toBe(1)
  })
})

describe("feather-page build and the layouts", () => {
  it("refuses a layout the brand's colours cannot carry, as a contradiction at /layout", () => {
    const dir = fs.mkdtempSync(path.join(work, "layout-"))
    // #767676 reads at 4.54:1 on white, so the engine takes the pair; on the hover tint it does not.
    const tokens = { schema: "feather-tokens/4", colors: { primary: "#1f3fd1", background: "#ffffff", surface: "#f5f5f5", text: "#111111", blocks: [{ surface: "#ffffff", ink: "#767676" }] }, typography: { fontFamily: { display: "Inter", body: "Inter" } } }
    fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify(tokens))
    fs.writeFileSync(path.join(dir, "page.json"), JSON.stringify({ schema: "feather.page/1", brand: "brand.json", layout: "colour-blocking", sections: [{ block: "hero", title: "One" }, { block: "statement", title: "Two" }] }))
    const r = cli(dir, ["build", "page.json", "--out", "out"])
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/- \/layout contradiction: colour-blocking puts sections on block-1/)
    expect(fs.existsSync(path.join(dir, "out"))).toBe(false)
    // The same page in a brand whose blocks read builds, with the ground on the second section.
    fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify({ ...tokens, colors: { ...tokens.colors, blocks: undefined } }))
    expect(cli(dir, ["build", "page.json", "--out", "out"]).code).toBe(0)
    expect(fs.readFileSync(path.join(dir, "out/index.html"), "utf8")).toMatch(/data-living-section="section-2" data-ground="block-1"/)
  })
})
