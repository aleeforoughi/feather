#!/usr/bin/env node
// feather-brand: theme a product from its brand tokens.
//
//   feather-brand [tokens.json] [--out <dir>] [--migrate [--to 3|4]]
//
// Reads brand/tokens.json by default and writes <out>/brand.css (theme variables and component tokens) and
// <out>/brand-fonts.css (font imports and open @font-face rules), <out>/brand-preload.html (preload links
// for display faces, feather-tokens/3 and /4 only), src/styles by default. --migrate rewrites the file in place
// instead: a qooe-tokens/1 or feather-tokens/2 file becomes feather-tokens/3, and a /3 or /4 file stays what it is.
// --to 4 upgrades it to feather-tokens/4 (a /3 file only gains the schema), and only when the result compiles: a file
// that would not theme is refused and left as it was. A migration never goes down. Deterministic: no network.
import fs from "node:fs"
import path from "node:path"
import { buildTheme, migrateTokens } from "../src/index.mjs"

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args.splice(i, 2)[1]
}
const migrate = args.includes("--migrate") && args.splice(args.indexOf("--migrate"), 1).length > 0
const hasTo = args.includes("--to")
const toFlag = hasTo ? flag("--to") : undefined
const to = toFlag === undefined ? undefined : /^\d+$/.test(toFlag) ? `feather-tokens/${toFlag}` : toFlag
if (hasTo && (!migrate || toFlag === undefined)) {
  console.error("--to names the schema a --migrate moves to: feather-brand --migrate --to 4")
  process.exit(1)
}
const out = flag("--out") ?? "src/styles"
const tokensPath = args[0] ?? "brand/tokens.json"

if (!fs.existsSync(tokensPath)) {
  console.log(`No ${tokensPath} yet — the product keeps Feather's neutral theme.`)
  process.exit(0)
}
const input = JSON.parse(fs.readFileSync(tokensPath, "utf8"))

if (migrate) {
  const result = migrateTokens(input, { to })
  if (!result.ok) {
    console.error(`Migration failed:\n- ${result.problems.join("\n- ")}`)
    process.exit(1)
  }
  // An explicit target is checked: the file is only rewritten when the migrated brand still themes.
  const check = to !== undefined ? buildTheme(result.tokens) : { ok: true }
  if (!check.ok) {
    console.error(`Migration refused (${tokensPath} is unchanged): as ${to} the brand would not theme:\n- ${check.problems.join("\n- ")}`)
    process.exit(1)
  }
  const { schema, ...rest } = result.tokens
  fs.writeFileSync(tokensPath, `${JSON.stringify({ schema, ...rest }, null, 2)}\n`)
  console.log(`${tokensPath}: ${result.from} → ${schema}`)
  process.exit(0)
}

const theme = buildTheme(input)
if (!theme.ok) {
  console.error(`Brand theme failed:\n- ${theme.problems.join("\n- ")}`)
  process.exit(1)
}
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, "brand.css"), theme.css)
fs.writeFileSync(path.join(out, "brand-fonts.css"), theme.fonts)
// feather-tokens/3: the display faces marked `preload`, as <link> tags for the document head.
if (theme.preload.length > 0) {
  const links = theme.preload.map((p) => `<link rel="preload" href="${p.href}" as="${p.as}" type="${p.type}" crossorigin="${p.crossorigin}">`)
  fs.writeFileSync(path.join(out, "brand-preload.html"), `${links.join("\n")}\n`)
}
console.log(`Brand theme applied: ${JSON.stringify(theme.summary)}`)
