// Feather hygiene — the gate every Feather release passes before it ships.
//
// An upgrade must not duplicate what exists, conflict with it, or leave a token, mapping or component
// unconnected. This checks the whole system, not only the change, so drift from earlier releases is caught too:
//
//   tokens     every semantic token is defined once per scope, has a dark value, is mapped into Tailwind,
//              and is written by the theme engine (or a brand theme would leak neutral values)
//   mappings   every var() and Tailwind mapping points at a token that exists; every token the engine
//              writes is consumed somewhere; component-token roles point at real tokens
//   components every atom has stories, one data-slot owner, no raw colors, no near-duplicate name,
//              no duplicate export; the manifest lists exactly the atoms that exist
//   themes     every reference theme compiles and reads (WCAG AA text, contrasting primary text), and every derived
//              emphasis color meets its contrast floor (docs/visual-system.md section 5): always a hard failure
//   visual     Gate 1 of the visual system (docs/visual-system.md section 12): static rules over the source of packages/react
//              and every manifest-* package (spacing steps, arbitrary values, motion, radius, border, shadow, weight,
//              opacity, icons, data-slot / data-variant, useThemeMotion). Since V1 normalized every component,
//              every finding is a failure (V1 is done); FEATHER_HYGIENE_V1=0 turns them back into counted warnings.
//   release    fonts are installed, every package / manifest / changelog agrees on the version
//   packaging  published source has no "@/" alias imports, the package entry exports every component,
//              every stylesheet import is a dependency of its package, the IR package has no dependencies,
//              the dialog engine is pure (no DOM, no node:, no clock) and the text body imports only dialog
//
// Deterministic: no network, no dependencies. Exit 1 with every problem listed.
import fs from "node:fs"
import path from "node:path"
import { buildTheme, CONTRAST_FLOORS, FONTS, TOKEN_SCHEMA, contrastRatio, fontImports as buildFontImports } from "../packages/tokens/src/index.mjs"

const TOKENS = "packages/tokens"
const REACT = "packages/react"
const UI = `${REACT}/src/components/ui`
const FOUNDATION_CSS = `${TOKENS}/css/foundation.css`
const STYLES_CSS = `${REACT}/styles.css`
/** Packages released together, at one version. */
const RELEASED = [TOKENS, REACT, "packages/intent", "packages/context", "packages/liquid", "packages/manifest-web", "packages/manifest-switch", "packages/manifest-voice", "packages/documents"]
const read = (p) => fs.readFileSync(p, "utf8")
const exists = (p) => fs.existsSync(p)

/** Tokens that are not colors, so are not mapped as --color-*. */
const NON_COLOR = new Set(["--radius"])
/** Engine-written variables Tailwind v4 consumes natively (its own theme namespace). */
const TAILWIND_NATIVE = /^--(spacing|shadow-(xs|sm|md|lg|xl)|radius-(xs|control|card|dialog))$/

/** Where the optical exceptions live (docs/visual-system.md section 9). */
const OPTICAL_EXCEPTIONS = `${REACT}/optical-exceptions.json`

export function hygiene(root = ".", { v1 = process.env.FEATHER_HYGIENE_V1 !== "0" } = {}) {
  const at = (p) => path.join(root, p)
  const problems = []
  const notes = []
  const css = read(at(FOUNDATION_CSS))

  // ── tokens ────────────────────────────────────────────────────────────────────────────────────
  const block = (selector) => {
    const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))
    return m ? m[2] : ""
  }
  const decls = (body) => [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  const scopes = { ":root": decls(block(":root")), ".dark": decls(block(".dark")), "@theme inline": decls(block("@theme inline")) }
  for (const [scope, list] of Object.entries(scopes)) {
    if (list.length === 0) problems.push(`${FOUNDATION_CSS} has no ${scope} block`)
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
  // A brand that sets headingWeight writes one more variable.
  const weighted = buildTheme({ colors: { primary: "#336699", background: "#ffffff", surface: "#f5f5f5", text: "#111111" }, typography: { fontFamily: { display: "Inter", body: "Inter" }, headingWeight: 600 } })
  const written = new Set([sample, weighted].flatMap((built) => (built.ok ? [...built.css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]) : [])))
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
  const sources = [...walk(at(`${REACT}/src`)), at(FOUNDATION_CSS), at(STYLES_CSS)].filter((f) => /\.(tsx?|css)$/.test(f))
  const corpus = sources.map(read).join("\n")
  for (const n of written) {
    if (semantic.has(n) || TAILWIND_NATIVE.test(n)) continue
    if (!corpus.includes(`var(${n}`)) problems.push(`the theme engine writes ${n} but nothing reads it — an orphan token (wire it or remove it)`)
  }
  // Every var() in components and styles resolves to something that exists.
  // Every variable foundation.css declares anywhere (layout tokens, density defaults, theme primitives) is known too.
  const declaredInFoundation = [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])
  const known = new Set([...semantic, ...written, ...declaredInFoundation, ...scopes["@theme inline"].map(([n]) => n)])
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

  // ── packaging ─────────────────────────────────────────────────────────────────────────────────
  const json = (p) => JSON.parse(read(at(p)))
  const tokensPkg = json(`${TOKENS}/package.json`)
  const reactPkg = json(`${REACT}/package.json`)
  const runtimeDeps = (p) => ({ ...p.dependencies, ...p.peerDependencies })
  for (const [family, dep] of Object.entries(FONTS)) {
    if (!tokensPkg.dependencies?.[dep]) problems.push(`font ${family} is offered by the theme engine but ${dep} is not a dependency of ${tokensPkg.name}`)
    for (const file of fontFiles(family)) if (!exists(at(`${TOKENS}/${file}`))) problems.push(`font ${family} has no ${TOKENS}/${file} — products could not load it`)
  }
  // A stylesheet a product imports may only import what its own package depends on (or its own files).
  for (const [file, pkg] of [[FOUNDATION_CSS, tokensPkg], [STYLES_CSS, reactPkg], ...walk(at(`${TOKENS}/fonts`)).map((f) => [path.relative(root, f), tokensPkg])]) {
    for (const m of read(at(file)).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@import\s+"([^".][^"]*)"/g)) {
      const dep = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0]
      if (dep !== "tailwindcss" && !runtimeDeps(pkg)[dep]) problems.push(`${file} imports ${m[1]} but ${dep} is not a dependency of ${pkg.name}`)
    }
  }
  // Every module the components import must be a runtime dependency, or products would not install it.
  for (const file of walk(at(`${REACT}/src`)).filter((f) => /\.tsx?$/.test(f) && !/\.(stories|test)\.tsx?$/.test(f) && !f.includes(`${path.sep}stories${path.sep}`))) {
    const body = read(file)
    if (/from\s+"@\//.test(body)) problems.push(`${path.relative(root, file)} imports through the "@/" alias — published type declarations cannot resolve it; use a relative import`)
    for (const m of body.matchAll(/from\s+"([^".][^"]*)"/g)) {
      const dep = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0]
      if (!runtimeDeps(reactPkg)[dep]) problems.push(`${path.relative(root, file)} imports ${m[1]} but ${dep} is not a dependency of ${reactPkg.name}`)
    }
  }
  // The IR package stands alone (docs/PLAN.md section 5): no dependencies, only its own modules.
  const intentPkg = json("packages/intent/package.json")
  if (Object.keys(intentPkg.dependencies ?? {}).length) problems.push(`${intentPkg.name} must have no dependencies; it has ${Object.keys(intentPkg.dependencies).join(", ")}`)
  for (const file of walk(at("packages/intent/src")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    for (const m of read(file).matchAll(/from\s+"([^"]+)"/g)) {
      if (!m[1].startsWith("./")) problems.push(`${path.relative(root, file)} imports ${m[1]}; the IR package imports only its own modules`)
    }
  }
  // The context package is types only; the composer imports only the IR and the context (docs/PLAN.md section 5).
  if (Object.keys(json("packages/context/package.json").dependencies ?? {}).length) problems.push("@aleeforoughi/feather-context must have no dependencies")
  for (const file of walk(at("packages/context/src")).filter((f) => f.endsWith(".ts"))) {
    if (/^\s*export\s+(const|function|class|let|enum)\b/m.test(read(file))) problems.push(`${path.relative(root, file)} exports runtime code; the context package is types only`)
  }
  for (const file of walk(at("packages/liquid/src")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    for (const m of read(file).matchAll(/from\s+"([^"]+)"/g)) {
      if (!m[1].startsWith("./") && m[1] !== "@aleeforoughi/feather-intent" && m[1] !== "@aleeforoughi/feather-context") problems.push(`${path.relative(root, file)} imports ${m[1]}; the composer imports only the IR, the context and its own modules`)
    }
  }
  // The dialog engine is pure, like the composer: it imports the IR, the composer and its own modules, nothing from
  // Node (no I/O) and no DOM, and it reads no clock and no randomness (docs/manifestations.md section 1).
  const DIALOG_IMPORTS = new Set(["@aleeforoughi/feather-intent", "@aleeforoughi/feather-liquid"])
  for (const file of sourceFiles(at("packages/dialog/src"))) {
    const source = read(file)
    const text = code(source)
    for (const spec of importsOf(stripComments(source))) {
      if (spec.startsWith("node:")) problems.push(`${path.relative(root, file)} imports ${spec}; the dialog engine does no I/O (it is pure, and runs in a browser)`)
      else if (!spec.startsWith("./") && !DIALOG_IMPORTS.has(spec)) problems.push(`${path.relative(root, file)} imports ${spec}; the dialog engine imports only the IR, the composer and its own modules`)
    }
    const dom = text.match(/\b(document|window|navigator|localStorage|sessionStorage|HTMLElement|requestAnimationFrame|queueMicrotask|setTimeout|setInterval|fetch|process|Buffer)\b/)
    if (dom) problems.push(`${path.relative(root, file)} uses the global ${dom[1]}; the dialog engine has no DOM and no I/O`)
    if (/\bDate\.now\b|\bnew Date\(\s*\)|\bMath\.random\b|\bperformance\.now\b/.test(text)) problems.push(`${path.relative(root, file)} reads the clock or randomness; the dialog engine is deterministic`)
  }
  const dialogPkg = json("packages/dialog/package.json")
  for (const dep of Object.keys(dialogPkg.dependencies ?? {})) if (!DIALOG_IMPORTS.has(dep)) problems.push(`${dialogPkg.name} depends on ${dep}; it depends only on the IR and the composer`)
  // The text manifestation is a body over the dialog engine: Feather's IR, composer and dialog, its own modules, and
  // Node's built-ins (it talks to a terminal).
  const TEXT_IMPORTS = new Set(["@aleeforoughi/feather-dialog", "@aleeforoughi/feather-liquid", "@aleeforoughi/feather-intent"])
  for (const file of sourceFiles(at("packages/manifest-text/src"))) {
    for (const spec of importsOf(stripComments(read(file)))) {
      if (!spec.startsWith("./") && !spec.startsWith("node:") && !TEXT_IMPORTS.has(spec)) problems.push(`${path.relative(root, file)} imports ${spec}; the text manifestation imports only the dialog engine, the composer, the IR, its own modules and node: built-ins`)
    }
  }
  const textPkg = json("packages/manifest-text/package.json")
  for (const dep of Object.keys(textPkg.dependencies ?? {})) if (!TEXT_IMPORTS.has(dep)) problems.push(`${textPkg.name} depends on ${dep}; it depends only on the dialog engine, the composer and the IR`)
  // The voice manifestation speaks and listens through whatever the host provides: the dialog engine, the composer and the
  // IR, its own modules, nothing from Node and no DOM (a speech engine is the host's, not the core's).
  const VOICE_IMPORTS = new Set(["@aleeforoughi/feather-dialog", "@aleeforoughi/feather-liquid", "@aleeforoughi/feather-intent"])
  for (const file of sourceFiles(at("packages/manifest-voice/src"))) {
    const source = read(file)
    for (const spec of importsOf(stripComments(source))) {
      if (!spec.startsWith("./") && !VOICE_IMPORTS.has(spec)) problems.push(`${path.relative(root, file)} imports ${spec}; the voice manifestation imports only the dialog engine, the composer, the IR and its own modules`)
    }
    const dom = code(source).match(/\b(document|window|navigator|localStorage|sessionStorage|HTMLElement|speechSynthesis|SpeechRecognition|webkitSpeechRecognition|SpeechSynthesisUtterance|fetch|process|Buffer)\b/)
    if (dom) problems.push(`${path.relative(root, file)} uses the global ${dom[1]}; the voice manifestation has no DOM and no speech engine of its own`)
  }
  const voicePkg = json("packages/manifest-voice/package.json")
  for (const dep of Object.keys(voicePkg.dependencies ?? {})) if (!VOICE_IMPORTS.has(dep)) problems.push(`${voicePkg.name} depends on ${dep}; it depends only on the dialog engine, the composer and the IR`)
  // The web manifestation renders plans with Feather: it imports Feather's packages and React, never the network or
  // a model, and reads semantic tokens only, like every component.
  const WEB_IMPORTS = new Set(["react", "@aleeforoughi/feather-intent", "@aleeforoughi/feather-context", "@aleeforoughi/feather-liquid", "@aleeforoughi/feather-dialog", "@aleeforoughi/feather-react", "@aleeforoughi/feather-tokens"])
  for (const file of walk(at("packages/manifest-web/src")).filter((f) => /\.tsx?$/.test(f) && !/\.(test|stories)\.tsx?$/.test(f) && !f.includes(`${path.sep}test${path.sep}`))) {
    const text = read(file)
    for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
      if (!m[1].startsWith("./") && !WEB_IMPORTS.has(m[1])) problems.push(`${path.relative(root, file)} imports ${m[1]}; the web manifestation imports only Feather's packages and React`)
    }
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/.test(text)) problems.push(`${path.relative(root, file)} uses a raw color; read semantic tokens`)
  }
  // The switch manifestation scans what the web manifestation renders: Feather's packages and React only, and semantic
  // tokens only.
  const SWITCH_IMPORTS = new Set([...WEB_IMPORTS, "@aleeforoughi/feather-manifest-web"])
  for (const file of walk(at("packages/manifest-switch/src")).filter((f) => /\.tsx?$/.test(f) && !/\.(test|stories)\.tsx?$/.test(f) && !f.includes(`${path.sep}test${path.sep}`))) {
    const text = read(file)
    for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
      if (!m[1].startsWith("./") && !SWITCH_IMPORTS.has(m[1])) problems.push(`${path.relative(root, file)} imports ${m[1]}; the switch manifestation imports only Feather's packages and React`)
    }
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/.test(text)) problems.push(`${path.relative(root, file)} uses a raw color; read semantic tokens`)
  }
  const entry = read(at(`${REACT}/src/index.ts`))
  for (const atom of atoms) if (!entry.includes(`"./components/ui/${atom}"`)) problems.push(`${REACT}/src/index.ts does not export ${atom} — products cannot import it`)

  // ── release ───────────────────────────────────────────────────────────────────────────────────
  const pkg = json("package.json")
  for (const dir of RELEASED) {
    const p = json(`${dir}/package.json`)
    if (p.version !== pkg.version) problems.push(`${p.name} is ${p.version} but Feather is ${pkg.version} — packages release together`)
  }
  const manifestPath = `${REACT}/foundation.json`
  if (exists(at(manifestPath))) {
    const manifest = JSON.parse(read(at(manifestPath)))
    if (manifest.version !== pkg.version) problems.push(`${manifestPath} is ${manifest.version} but Feather is ${pkg.version} — regenerate the manifest (pnpm manifest)`)
    if (manifest.tokenSchema !== TOKEN_SCHEMA) problems.push(`${manifestPath} declares token schema ${manifest.tokenSchema}, but the engine writes ${TOKEN_SCHEMA} — regenerate the manifest`)
    const listed = (manifest.components ?? []).map((c) => (typeof c === "string" ? c : c.name ?? c.id)).map((n) => String(n).toLowerCase().replace(/\s+/g, "-")).sort()
    const missing = atoms.filter((a) => !listed.includes(a))
    const extra = listed.filter((n) => !atoms.includes(n))
    if (missing.length || extra.length) problems.push(`${manifestPath} is out of sync with the atoms (missing: ${missing.join(", ") || "none"}; no longer exist: ${extra.join(", ") || "none"})`)
  } else problems.push(`${manifestPath} is missing — run \`pnpm manifest\``)
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) problems.push(`package.json version ${pkg.version} is not semver`)
  if (!exists(at("CHANGELOG.md")) || !read(at("CHANGELOG.md")).includes(`## ${pkg.version}`)) problems.push(`CHANGELOG.md has no entry for ${pkg.version}`)

  // ── themes ────────────────────────────────────────────────────────────────────────────────────
  const themeDir = at(`${TOKENS}/themes`)
  const themes = exists(themeDir) ? fs.readdirSync(themeDir).filter((f) => f.endsWith(".json")) : []
  if (themes.length < 2) problems.push(`fewer than two reference themes in ${TOKENS}/themes — upgrades cannot be proven themeable`)
  for (const file of themes) {
    const theme = JSON.parse(read(path.join(themeDir, file)))
    const built = buildTheme(theme.tokens ?? {})
    if (!built.ok) {
      problems.push(`reference theme ${file} no longer compiles: ${built.problems.join("; ")}`)
      continue
    }
    const raw = Object.fromEntries([...built.css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2]]))
    // Aliases (--foreground: var(--text-primary)) are followed to the color they name.
    const v = (name) => follow(raw, name)
    const pairs = [["--foreground", "--background", 4.5], ["--card-foreground", "--card", 4.5], ["--primary-foreground", "--primary", 4.5]]
    for (const [fg, bg, min] of pairs) {
      const ratio = contrastRatio(v(fg), v(bg))
      if (ratio !== null && ratio < min) problems.push(`reference theme ${file}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, below WCAG AA ${min}:1`)
    }
    // Emphasis (section 5): every derived color meets its floor on --background and --card. Hard, always.
    const floors = [
      ["--text-primary", CONTRAST_FLOORS.textPrimary],
      ["--text-secondary", CONTRAST_FLOORS.textSecondary],
      ["--text-tertiary", CONTRAST_FLOORS.textTertiary],
      ["--border-primary", CONTRAST_FLOORS.borderPrimary],
    ]
    for (const [token, min] of floors) {
      for (const surface of ["--background", "--card"]) {
        const ratio = contrastRatio(v(token), v(surface))
        if (ratio === null) problems.push(`reference theme ${file}: ${token} (${raw[token]}) is not a plain color the audit can measure`)
        else if (ratio < min) problems.push(`reference theme ${file}: ${token} on ${surface} is ${ratio.toFixed(2)}:1, below its ${min}:1 floor`)
      }
    }
  }
  notes.push(`${atoms.length} components, ${semantic.size} semantic tokens, ${themes.length} reference themes`)

  // ── visual (Gate 1, docs/visual-system.md section 12) ─────────────────────────────────────────────────────────────
  const exceptions = loadExceptions(at(OPTICAL_EXCEPTIONS), problems)
  const scan = scanVisual(root, exceptions)
  const warnings = []
  for (const rule of VISUAL_RULES) {
    const found = scan.byRule.get(rule) ?? []
    if (found.length === 0) continue
    const sample = found.slice(0, 3).map((f) => `${f.file}: ${f.token}`).join("; ")
    if (v1) problems.push(`visual/${rule}: ${found.length} in ${new Set(found.map((f) => f.file)).size} files (${sample})`)
    else warnings.push(`visual/${rule}: ${found.length} in ${new Set(found.map((f) => f.file)).size} files (first: ${sample})`)
  }
  notes.push(`${scan.files} source files scanned for the visual rules (${scan.total} findings${v1 ? "" : ", warnings until components are normalized"})`)
  return { ok: problems.length === 0, problems, notes, warnings, visual: { total: scan.total, counts: Object.fromEntries(VISUAL_RULES.map((r) => [r, (scan.byRule.get(r) ?? []).length])), findings: scan.findings } }
}

/** The files in this package a font's stylesheet import points at ("fonts/inter.css"). */
function fontFiles(family) {
  return buildFontImports(family).map((spec) => spec.replace(/^@aleeforoughi\/feather-tokens\//, ""))
}

/** TypeScript sources of a package, without tests, stories and test helpers. */
function sourceFiles(dir) {
  return walk(dir).filter((f) => /\.tsx?$/.test(f) && !/\.(test|stories)\.tsx?$/.test(f) && !f.includes(`${path.sep}test${path.sep}`))
}

/** Source without comments, so prose is not read as code. Strings stay (an import names its module in one). */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
}

/** Source without comments and without the inside of string literals, so a word in a message is not read as code. */
function code(text) {
  return stripComments(text)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
}

/** Every module a source file imports or re-exports from: from "x", import "x", import("x"), require("x"). */
function importsOf(text) {
  return [...text.matchAll(/\b(?:from|import|require)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1])
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

/** A custom property's value, with var() aliases followed to the end. */
function follow(vars, name) {
  let value = vars[name]
  for (let i = 0; i < 8 && typeof value === "string" && value.startsWith("var("); i++) value = vars[value.slice(4, -1).split(",")[0].trim()]
  return value
}

// ── Gate 1: the static visual rules ───────────────────────────────────────────────────────────────────────────────

/** Every rule the static scan has, in the order they are reported. */
export const VISUAL_RULES = [
  "spacing-step",
  "arbitrary-value",
  "transition-all",
  "duration",
  "ease",
  "radius-tier",
  "border-width",
  "shadow",
  "font-weight",
  "opacity",
  "slash-opacity",
  "bare-icon",
  "data-slot",
  "data-variant",
  "theme-motion",
  "region",
]

/** The Tailwind steps the system allows (section 2): 0, 0.5 (optical only), 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32. */
const STEPS = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"])
const SPACING = "(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|start|end|size|w|h|min-w|min-h|max-w|max-h|basis|translate-x|translate-y|scroll-m|scroll-p)"
const SPACING_RE = new RegExp(`^-?${SPACING}-(\\d+(?:\\.\\d+)?)$`)
/** A one pixel nudge (mt-px, -translate-y-px), which is an optical exception. w-px, h-px and size-px are 1px lines and fine. */
const NUDGE_RE = /^-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|inset|inset-x|inset-y|top|right|bottom|left|translate-x|translate-y)-px$/
const FONT_SIZES = new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"])

/** Class tokens of a source file: the whitespace-separated pieces of its string and template literals. */
function classTokens(source) {
  const out = []
  const literal = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  const text = stripComments(source)
  for (const m of text.matchAll(literal)) {
    const line = text.slice(0, m.index).split("\n").length
    for (const piece of (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) if (piece) out.push({ token: piece, line })
  }
  return out
}

/** A class token without its variants (hover:, data-[x]:, [&_svg]:), importance marks and negative sign: the utility itself. */
function coreOf(token) {
  let depth = 0
  let cut = 0
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === "[" || ch === "(") depth++
    else if (ch === "]" || ch === ")") depth--
    else if (ch === ":" && depth === 0) cut = i + 1
  }
  return token.slice(cut).replace(/^!/, "").replace(/!$/, "")
}

/** The visual rules one class token breaks (a token may break more than one). */
function ruleOfToken(token) {
  const core = coreOf(token)
  const hit = []
  const spacing = SPACING_RE.exec(core)
  if (spacing && !STEPS.has(spacing[1])) hit.push("spacing-step")
  else if (NUDGE_RE.test(core)) hit.push("spacing-step")
  if (/-\[[^\]]*\d(?:px|rem|em|ms|%)[^\]]*\]/.test(token)) hit.push("arbitrary-value")
  if (core === "transition-all") hit.push("transition-all")
  // Surface padding is a region's (section 3a): the retired one-value paddings are findings.
  if (core === "p-card" || core === "p-dialog") hit.push("region")
  if (/^duration-(?:\d+|\[.*\])$/.test(core)) hit.push("duration")
  if (/^ease-/.test(core) && core !== "ease-standard") hit.push("ease")
  if (/^rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|ee|es))?-(?:sm|md|lg|xl|2xl|3xl|4xl)$/.test(core)) hit.push("radius-tier")
  if (/^border(?:-[xytblrse])?-(?:2|4|8)$/.test(core) || /^border(?:-[xytblrse])?-\[/.test(core)) hit.push("border-width")
  const shadow = /^shadow-(.+)$/.exec(core)
  if (shadow && !["none", "1", "2", "3"].includes(shadow[1])) hit.push("shadow")
  if (/^font-(?:thin|extralight|light|extrabold|black)$/.test(core)) hit.push("font-weight")
  const opacity = /^opacity-(.+)$/.exec(core)
  if (opacity && !["0", "100", "disabled"].includes(opacity[1])) hit.push("opacity")
  const slash = /^(?:text|border(?:-[xytblrse])?|fill|stroke)-([a-z][a-z0-9-]*)\/(?:\d+|\[[^\]]*\])$/.exec(core)
  if (slash && !FONT_SIZES.has(slash[1])) hit.push("slash-opacity")
  return hit
}

/** The lucide components a source file imports, by the name it uses. */
function lucideNames(source) {
  const names = new Set()
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/g)) {
    for (const part of m[1].split(",").map((x) => x.trim()).filter(Boolean)) names.add(part.split(/\s+as\s+/).pop().trim())
  }
  return names
}

/**
 * The visual findings in one source file: [{ rule, file, token, line }]. `exceptions` is the allowlist of
 * optical-exceptions.json ({ file, value }): a 0.5 step, a one pixel nudge or an arbitrary value listed there is accepted.
 * `rel` is the file's path from the repository root.
 */
export function scanSource(rel, source, exceptions = []) {
  const findings = []
  const allowed = (token, core) => exceptions.some((e) => e.file === rel && (e.value === token || e.value === core))
  const add = (rule, token, line) => findings.push({ rule, file: rel, token, line })
  for (const { token, line } of classTokens(source)) {
    const core = coreOf(token)
    for (const rule of ruleOfToken(token)) if (!((rule === "spacing-step" || rule === "arbitrary-value") && allowed(token, core))) add(rule, token, line)
  }
  const text = stripComments(source)
  for (const m of text.matchAll(/transition(?:-property)?\s*:\s*["']?\s*all\b/g)) add("transition-all", m[0], text.slice(0, m.index).split("\n").length)
  // Every region uses its role's inset utility (section 3a), on the same element.
  for (const m of text.matchAll(/<[A-Za-z][\w.]*\b((?:[^<>{}]|\{[^{}]*\})*)>/g)) {
    const role = /\bdata-region\s*=\s*"(\w+)"/.exec(m[1])?.[1]
    if (!role) continue
    if (!["content", "header", "action", "utility", "display"].includes(role)) add("region", `data-region="${role}"`, text.slice(0, m.index).split("\n").length)
    else if (!new RegExp(`\\binset-${role}\\b`).test(m[1])) add("region", `data-region="${role}" without inset-${role}`, text.slice(0, m.index).split("\n").length)
  }
  // A bare lucide icon with its own size: a size class, or a size, width or height prop.
  const lucide = lucideNames(text)
  const isIcon = /(^|\/)components\/ui\/icon\.tsx$/.test(rel)
  if (lucide.size > 0 && !isIcon) {
    for (const m of text.matchAll(new RegExp(`<(${[...lucide].join("|")})\\b((?:[^<>{}]|\\{[^{}]*\\})*)/?>`, "g"))) {
      const attrs = m[2]
      if (/\bclassName\s*=\s*(?:"[^"]*|\{[^}]*)\b(?:size|w|h)-/.test(attrs) || /\b(?:size|width|height)\s*=/.test(attrs)) add("bare-icon", `<${m[1]}>`, text.slice(0, m.index).split("\n").length)
    }
  }
  // Components: every part carries data-slot, every variant data-variant, and animated components read the theme's motion.
  if (/(^|\/)components\//.test(rel) && /\.tsx$/.test(rel) && !isIcon) {
    const usesRender = /\buseRender\b/.test(text)
    if (!usesRender) {
      for (const m of text.matchAll(/<([a-z][a-zA-Z0-9]*|[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*)\b((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g)) {
        const [, tag, attrs] = m
        if (/^(svg|path|g|circle|rect|line|polyline|polygon|defs|use|stop|linearGradient|clipPath)$/.test(tag)) continue
        if (/\bclassName\s*=/.test(attrs) && !/\bdata-slot\s*=/.test(attrs)) add("data-slot", `<${tag}>`, text.slice(0, m.index).split("\n").length)
      }
    }
    // A component with variants says which: data-variant, or the `state: { slot, variant }` that useRender turns into one.
    if (/\bcva\s*\(/.test(text) && !/\bdata-variant\s*=/.test(text) && !/\bslot\s*:\s*"[^"]+"\s*,\s*variant\b/.test(text)) add("data-variant", "cva variants without data-variant", 1)
    if (/from\s+"motion\/react"/.test(text) && !/\buseThemeMotion\b/.test(text) && !/lib\/motion\.ts$/.test(rel)) add("theme-motion", "motion/react without useThemeMotion", 1)
  }
  return findings
}

/** The files the visual rules cover: packages/react/src and every manifest-*'s src, without stories, tests and test dirs. */
function visualFiles(root) {
  const dirs = [`${REACT}/src`, ...fs.readdirSync(path.join(root, "packages")).filter((d) => d.startsWith("manifest-")).map((d) => `packages/${d}/src`)]
  return dirs.flatMap((dir) => sourceFiles(path.join(root, dir)))
}

function scanVisual(root, exceptions) {
  const files = visualFiles(root)
  const findings = files.flatMap((file) => scanSource(path.relative(root, file).split(path.sep).join("/"), read(file), exceptions))
  const byRule = new Map()
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f])
  return { files: files.length, findings, byRule, total: findings.length }
}

/** optical-exceptions.json: { "exceptions": [{ file, value, reason, reviewer }] }. A malformed entry is a problem. */
function loadExceptions(file, problems) {
  if (!exists(file)) {
    problems.push(`${OPTICAL_EXCEPTIONS} is missing — it lists the optical exceptions (an empty "exceptions" array when there are none)`)
    return []
  }
  let data
  try {
    data = JSON.parse(read(file))
  } catch (error) {
    problems.push(`${OPTICAL_EXCEPTIONS} is not valid JSON: ${error.message}`)
    return []
  }
  const list = Array.isArray(data.exceptions) ? data.exceptions : null
  if (!list) {
    problems.push(`${OPTICAL_EXCEPTIONS} needs an "exceptions" array`)
    return []
  }
  list.forEach((e, i) => {
    for (const key of ["file", "value", "reason", "reviewer"]) if (typeof e?.[key] !== "string" || e[key].trim() === "") problems.push(`${OPTICAL_EXCEPTIONS} exceptions[${i}] needs a "${key}"`)
  })
  return list.filter((e) => e && typeof e.file === "string" && typeof e.value === "string")
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const result = hygiene(path.resolve(import.meta.dirname, ".."))
  for (const warning of result.warnings) console.log(`warning: ${warning}`)
  if (process.env.FEATHER_HYGIENE_DETAIL === "1") for (const f of result.visual.findings) console.log(`  ${f.rule}  ${f.file}:${f.line}  ${f.token}`)
  if (!result.ok) {
    console.log(`Feather hygiene failed (${result.problems.length}):\n- ${result.problems.join("\n- ")}`)
    process.exit(1)
  }
  console.log(`Feather hygiene passed: ${result.notes.join("; ")}.`)
}
