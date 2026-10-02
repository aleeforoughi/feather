#!/usr/bin/env node
// feather-brand: theme a product from its brand tokens.
//
//   feather-brand [tokens.json] [--out <dir>] [--migrate]
//
// Reads brand/tokens.json by default and writes <out>/brand.css (theme variables and component tokens) and
// <out>/brand-fonts.css (font imports), src/styles by default. --migrate rewrites a qooe-tokens/1 file in place as
// feather-tokens/2 instead. Deterministic: no network.
import fs from "node:fs"
import path from "node:path"
import { buildTheme, migrateTokens } from "../src/index.mjs"

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args.splice(i, 2)[1]
}
const migrate = args.includes("--migrate") && args.splice(args.indexOf("--migrate"), 1).length > 0
const out = flag("--out") ?? "src/styles"
const tokensPath = args[0] ?? "brand/tokens.json"

if (!fs.existsSync(tokensPath)) {
  console.log(`No ${tokensPath} yet — the product keeps Feather's neutral theme.`)
  process.exit(0)
}
const input = JSON.parse(fs.readFileSync(tokensPath, "utf8"))

if (migrate) {
  const result = migrateTokens(input)
  if (!result.ok) {
    console.error(`Migration failed:\n- ${result.problems.join("\n- ")}`)
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
console.log(`Brand theme applied: ${JSON.stringify(theme.summary)}`)
