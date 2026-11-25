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
})
