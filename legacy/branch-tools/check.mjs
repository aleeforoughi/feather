// QOOE product checks for a Feather branch. Runs only what exists, so each stage of the crew is checked
// as soon as its deliverable appears: brand → design → theme/branch → built product.
// Deterministic: no network, no dependencies.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { buildTheme } from "./apply-brand.mjs"

const problems = []
const notes = []
const read = (p) => fs.readFileSync(p, "utf8")
const exists = (p) => fs.existsSync(p)

// 1. Brand: logo, mark and tokens files (transparent PNGs, token shape).
if (exists("brand/tokens.json") || exists("brand/logo.png")) {
  try {
    execFileSync(process.execPath, ["scripts/check-brand.mjs"], { stdio: "inherit" })
  } catch {
    problems.push("the brand check failed (see above)")
  }
  // The tokens must compile through the Feather theme engine (fonts from the Feather set, valid axes,
  // allowed component tokens).
  try {
    const theme = buildTheme(JSON.parse(read("brand/tokens.json")))
    if (!theme.ok) problems.push(...theme.problems.map((p) => `brand/tokens.json: ${p}`))
    else if (exists("src/styles/brand.css") && !read("src/styles/brand.css").startsWith("/* Neutral foundation theme")) {
      if (read("src/styles/brand.css") !== theme.css) problems.push("src/styles/brand.css is not the theme generated from brand/tokens.json — run `brand`, never edit it by hand")
    }
  } catch (err) {
    problems.push(`brand/tokens.json could not be read: ${err.message}`)
  }
}

// 2. Design: system architecture and page designs at both widths.
const isPng = (file) => {
  const b = fs.readFileSync(file)
  return b.length > 24 && b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
}
if (exists("design/system.md")) {
  const text = read("design/system.md").toLowerCase()
  for (const level of ["atoms", "molecules", "organisms", "templates"]) {
    if (!text.includes(level)) problems.push(`design/system.md does not mention ${level}; map the product onto Feather's atomic levels by name`)
  }
}
if (exists("design/pages")) {
  const files = fs.readdirSync("design/pages").filter((f) => f.endsWith(".png"))
  for (const f of files) {
    if (!isPng(path.join("design/pages", f))) problems.push(`design/pages/${f} is not a valid PNG`)
    const m = f.match(/^(.+)-(390|1280)\.png$/)
    if (!m) problems.push(`design/pages/${f} must be named <page>-390.png or <page>-1280.png`)
    else if (!files.includes(`${m[1]}-${m[2] === "390" ? "1280" : "390"}.png`)) problems.push(`design/pages/${f} needs its ${m[2] === "390" ? "1280" : "390"}px twin`)
  }
}
if (exists("design/feather.json")) {
  try {
    const sel = JSON.parse(read("design/feather.json"))
    if (!Array.isArray(sel.components) || sel.components.length === 0) problems.push("design/feather.json must list the Feather components this product uses")
  } catch {
    problems.push("design/feather.json is not valid JSON")
  }
}

// 3. Branch integrity: themed atoms are Feather's, unchanged since the branch was cut.
if (exists("feather.lock.json")) {
  const lock = JSON.parse(read("feather.lock.json"))
  for (const [file, hash] of Object.entries(lock.atoms ?? {})) {
    if (!exists(file)) problems.push(`${file} is part of this Feather branch but is missing`)
    else if (crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== hash) {
      problems.push(`${file} was edited; Feather atoms are themed through brand/tokens.json, not edited (record the need as a Feather gap)`)
    }
  }
  notes.push(`Feather ${lock.feather} branch with ${lock.components.length} components`)
}

// 4. The built product: pages compose the design system; no raw colors outside the generated theme.
const app = exists("src/App.tsx") ? read("src/App.tsx") : ""
const built = app && !/QOOE is building this product\./.test(app) && !/Showcase/.test(app)
if (built) {
  const walk = (dir) =>
    exists(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
      : []
  const pages = walk("src/pages").filter((f) => f.endsWith(".tsx"))
  if (pages.length === 0) problems.push("src/pages/ has no pages; compose each page there from Feather components")
  for (const page of pages) {
    const body = read(page)
    if (!/@\/components\/(ui|molecules|organisms|templates)/.test(body) && !/\.\.\/components\//.test(body)) {
      problems.push(`${page} does not compose Feather components (import from @/components/ui, molecules, organisms or templates)`)
    }
  }
  const generated = new Set(["src/styles/brand.css", "src/styles/brand-fonts.css", "src/index.css"])
  for (const file of walk("src").filter((f) => /\.(tsx?|css)$/.test(f) && !generated.has(f) && !f.includes("/components/ui/") && !f.endsWith(".stories.tsx"))) {
    const text = read(file)
    const hex = [...text.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b|(?<=:\s*)#[0-9a-fA-F]{3}\b/g)].map((m) => m[0])
    if (hex.length > 0) problems.push(`${file} uses raw colors (${[...new Set(hex)].join(", ")}); use the theme's semantic classes (bg-primary, text-foreground, …)`)
    if (/simulat(e|ed|ion)\b/i.test(text) && /success/i.test(text)) problems.push(`${file} appears to simulate success instead of doing the work`)
  }
  if (/<title>(Product|web|Vite \+ React)<\/title>/i.test(read("index.html"))) problems.push("index.html still has a placeholder title")
}

if (problems.length > 0) {
  console.log(`Product check failed:\n- ${problems.join("\n- ")}`)
  process.exit(1)
}
console.log(`Product check passed.${notes.length ? ` ${notes.join("; ")}.` : ""}`)
