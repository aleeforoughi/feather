// Feather hygiene — the gate every Feather release passes before Bootstrap may ship it.
//
// Bootstrap owns Feather's upgrades, and owns keeping it clean: an upgrade must not duplicate what
// exists, conflict with it, or leave a token, mapping or component unconnected. This checks the whole
// system, not only the change, so drift from earlier releases is caught too:
//
//   tokens     every semantic token is defined once per scope, has a dark value, is mapped into Tailwind,
//              and is written by the theme engine (or a brand theme would leak neutral values)
//   mappings   every var() and Tailwind mapping points at a token that exists; every token the engine
//              writes is consumed somewhere; component-token roles point at real tokens
//   components every atom has stories, one data-slot owner, no raw colors, no near-duplicate name,
//              no duplicate export; the manifest lists exactly the atoms that exist
//   themes     every reference theme compiles and reads (WCAG AA text, contrasting primary text)
//   release    fonts are installed, version / manifest / changelog agree
//
// Deterministic: no network, no dependencies. Exit 1 with every problem listed.
import fs from "node:fs"
import path from "node:path"
import { buildTheme, FONTS, contrastRatio } from "./apply-brand.mjs"

const UI = "src/components/ui"
const read = (p) => fs.readFileSync(p, "utf8")
const exists = (p) => fs.existsSync(p)

/** Tokens that are not colors, so are not mapped as --color-*. */
const NON_COLOR = new Set(["--radius"])
/** Engine-written variables Tailwind v4 consumes natively (its own theme namespace). */
const TAILWIND_NATIVE = /^--(spacing|shadow-(xs|sm|md|lg|xl))$/

export function hygiene(root = ".") {
  const at = (p) => path.join(root, p)
  const problems = []
  const notes = []
  const css = read(at("src/index.css"))

  // ── tokens ────────────────────────────────────────────────────────────────────────────────────
  const block = (selector) => {
    const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))
    return m ? m[2] : ""
  }
  const decls = (body) => [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  const scopes = { ":root": decls(block(":root")), ".dark": decls(block(".dark")), "@theme inline": decls(block("@theme inline")) }
  for (const [scope, list] of Object.entries(scopes)) {
    if (list.length === 0) problems.push(`src/index.css has no ${scope} block`)
    const seen = new Map()
    for (const [name, value] of list) {
      if (seen.has(name)) problems.push(`${scope} defines ${name} twice (${seen.get(name)} / ${value}) — conflicting values`)
      seen.set(name, value)
    }
  }
  const semantic = new Set(scopes[":root"].map(([n]) => n))
  const dark = new Set(scopes[".dark"].map(([n]) => n))
  for (const n of semantic) if (!dark.has(n) && !NON_COLOR.has(n)) problems.push(`${n} has no .dark value — dark mode would show the light token`)
  for (const n of dark) if (!semantic.has(n)) problems.push(`.dark defines ${n}, which is not a semantic token in :root`)

  // What the theme engine writes for a minimal brand.
  const sample = buildTheme({ colors: { primary: "#336699", background: "#ffffff", surface: "#f5f5f5", text: "#111111" }, typography: { fontFamily: { display: "Inter", body: "Inter" } } })
  if (!sample.ok) problems.push(`the theme engine rejects a minimal brand: ${sample.problems.join("; ")}`)
  const written = new Set(sample.ok ? [...sample.css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]) : [])
  const mapped = new Map()
  for (const [name, value] of scopes["@theme inline"]) {
    for (const ref of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!semantic.has(ref[1]) && !written.has(ref[1])) problems.push(`@theme ${name} maps to ${ref[1]}, which is not defined — a broken mapping`)
      mapped.set(ref[1], name)
    }
  }
  for (const n of semantic) if (!mapped.has(n)) problems.push(`${n} is never mapped into Tailwind (@theme inline) — components cannot use it`)
  // Two utilities for the same token are an alias pair: one name too many.
  const byTarget = new Map()
  for (const [name, value] of scopes["@theme inline"]) {
    const m = value.match(/^var\((--[a-z0-9-]+)\)$/)
    if (!m) continue
    if (byTarget.has(m[1])) problems.push(`${byTarget.get(m[1])} and ${name} both map ${m[1]} — duplicate semantic aliases`)
    byTarget.set(m[1], name)
  }

  // The theme engine must write every semantic token, or a brand leaks the neutral foundation.
  for (const n of semantic) if (!written.has(n)) problems.push(`the theme engine never writes ${n} — every brand would keep the neutral value`)

  // Every token the engine writes must be read by something.
  const sources = walk(at("src")).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(path.join("styles", "brand.css")))
  const corpus = sources.map(read).join("\n")
  for (const n of written) {
    if (semantic.has(n) || TAILWIND_NATIVE.test(n)) continue
    if (!corpus.includes(`var(${n}`)) problems.push(`the theme engine writes ${n} but nothing reads it — an orphan token (wire it or remove it)`)
  }
  // Every var() in components and styles resolves to something that exists.
  const known = new Set([...semantic, ...written, ...scopes["@theme inline"].map(([n]) => n)])
  for (const file of sources) {
    for (const m of read(file).matchAll(/var\((--[a-z0-9-]+)/g)) {
      const n = m[1]
      if (known.has(n) || /^--(tw|radix|base|anchor|available|transform|popup|accordion|collapsible|scroll|active|tab|indicator|toast|width|height|normal|z|offset|gap|cell|slot|icon|kbd|color-|font-|radius-|text-|spacing)/.test(n)) continue
      problems.push(`${path.relative(root, file)} reads ${n}, which no token defines — a missing connection`)
    }
  }

  // ── components ────────────────────────────────────────────────────────────────────────────────
  const atoms = fs.readdirSync(at(UI)).filter((f) => f.endsWith(".tsx") && !f.endsWith(".stories.tsx")).map((f) => f.slice(0, -4)).sort()
  const slotOwner = new Map()
  const exportOwner = new Map()
  for (const atom of atoms) {
    const file = at(`${UI}/${atom}.tsx`)
    const body = read(file)
    if (!exists(at(`${UI}/${atom}.stories.tsx`))) problems.push(`${atom} has no stories — it is undocumented and missing from every themed sheet`)
    const raw = [...body.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/g)].map((m) => m[0])
    if (raw.length > 0) problems.push(`${atom} uses raw colors (${[...new Set(raw)].join(", ")}) — atoms read semantic tokens only, or themes cannot reach them`)
    for (const m of body.matchAll(/data-slot="([a-z0-9-]+)"/g)) {
      const owner = slotOwner.get(m[1])
      if (owner && owner !== atom) problems.push(`data-slot "${m[1]}" is used by ${owner} and ${atom} — a component token would restyle both`)
      slotOwner.set(m[1], atom)
    }
    const exported = body.match(/export\s*\{([^}]*)\}/)
    for (const name of (exported?.[1] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) {
      if (name.startsWith("type ")) continue
      const owner = exportOwner.get(name)
      if (owner && owner !== atom) problems.push(`${name} is exported by both ${owner} and ${atom} — duplicate component`)
      exportOwner.set(name, atom)
    }
  }
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const [a, b] = [atoms[i], atoms[j]]
      if (Math.min(a.length, b.length) >= 5 && distance(a, b) <= 2) problems.push(`atoms ${a} and ${b} have near-identical names — likely a duplicate; merge or rename`)
    }
  }
  for (const story of fs.readdirSync(at(UI)).filter((f) => f.endsWith(".stories.tsx"))) {
    if (!atoms.includes(story.slice(0, -12))) problems.push(`${story} documents a component that does not exist`)
  }

  // ── release ───────────────────────────────────────────────────────────────────────────────────
  const pkg = JSON.parse(read(at("package.json")))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const [family, dep] of Object.entries(FONTS)) if (!deps[dep]) problems.push(`font ${family} is offered by the theme engine but ${dep} is not installed`)
  for (const m of css.matchAll(/@import\s+"([^".][^"]*)"/g)) {
    const dep = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0]
    if (!deps[dep]) problems.push(`src/index.css imports ${m[1]} but ${dep} is not a dependency`)
  }
  if (exists(at("foundation.json"))) {
    const manifest = JSON.parse(read(at("foundation.json")))
    if (manifest.version !== pkg.version) problems.push(`foundation.json is ${manifest.version} but package.json is ${pkg.version} — regenerate the manifest`)
    const listed = (manifest.components ?? []).map((c) => (typeof c === "string" ? c : c.name ?? c.id)).map((n) => String(n).toLowerCase().replace(/\s+/g, "-")).sort()
    const missing = atoms.filter((a) => !listed.includes(a))
    const extra = listed.filter((n) => !atoms.includes(n))
    if (missing.length || extra.length) problems.push(`foundation.json is out of sync with the atoms (missing: ${missing.join(", ") || "none"}; no longer exist: ${extra.join(", ") || "none"})`)
  } else problems.push("foundation.json is missing — run `npm run manifest`")
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) problems.push(`package.json version ${pkg.version} is not semver`)
  if (!exists(at("CHANGELOG.md")) || !read(at("CHANGELOG.md")).includes(`## ${pkg.version}`)) problems.push(`CHANGELOG.md has no entry for ${pkg.version}`)

  // ── themes ────────────────────────────────────────────────────────────────────────────────────
  const themeDir = at("themes")
  const themes = exists(themeDir) ? fs.readdirSync(themeDir).filter((f) => f.endsWith(".json")) : []
  if (themes.length < 2) problems.push("fewer than two reference themes in themes/ — upgrades cannot be proven themeable")
  for (const file of themes) {
    const theme = JSON.parse(read(path.join(themeDir, file)))
    const built = buildTheme(theme.tokens ?? {})
    if (!built.ok) {
      problems.push(`reference theme ${file} no longer compiles: ${built.problems.join("; ")}`)
      continue
    }
    const v = Object.fromEntries([...built.css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]]))
    const pairs = [["--foreground", "--background", 4.5], ["--card-foreground", "--card", 4.5], ["--primary-foreground", "--primary", 4.5]]
    for (const [fg, bg, min] of pairs) {
      const ratio = contrastRatio(v[fg], v[bg])
      if (ratio !== null && ratio < min) problems.push(`reference theme ${file}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below WCAG AA ${min}:1`)
    }
  }
  notes.push(`${atoms.length} atoms, ${semantic.size} semantic tokens, ${themes.length} reference themes`)
  return { ok: problems.length === 0, problems, notes }
}

function walk(dir) {
  return exists(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []
}

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const result = hygiene(".")
  if (!result.ok) {
    console.log(`Feather hygiene failed (${result.problems.length}):\n- ${result.problems.join("\n- ")}`)
    process.exit(1)
  }
  console.log(`Feather hygiene passed: ${result.notes.join("; ")}.`)
}
