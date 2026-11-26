#!/usr/bin/env node
// feather-page: websites from a feather.page/0 or /1 document.
//
//   feather-page init <template> [--out file] [--theme <theme.json>] [--force]
//                                                writes a template's page document (launch, studio, editorial, service,
//                                                product, creator), ready to edit and build; never over a file without
//                                                --force. --theme points `brand` at a theme file (and derives a scheme's
//                                                other set from it). `init --list` lists the templates.
//   feather-page validate <page.json>            every issue, with its JSON pointer; exit 1 when invalid
//   feather-page routes <page.json>              the static routes: the base page and one per prepared scene
//   feather-page build <page.json> --out <dir> [--css <href>] [--base </>] [--runtime <href>]
//                                                writes index.html, <intent>/index.html and (with notFound) 404.html,
//                                                readable with no script. With --runtime (the release's
//                                                feather-page-runtime.js), each page also carries its document and
//                                                brand and hydrates: motion, the loader, the menu, the Living Page.
//
// `brand` in the page is read relative to the page file: a feather-tokens file, or a reference theme ({ tokens }).
// Deterministic: no network, no model.
import fs from "node:fs"
import path from "node:path"
import { buildPage, pageRoutes, pageTokens } from "./build.mjs"

const [command, file, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(name)
  return i === -1 ? fallback : rest[i + 1]
}
const usage = () => {
  console.error("usage: feather-page validate|routes|build <page.json> [--out dir] [--css href] [--base /]\n       feather-page init <template> [--out file] [--theme theme.json] [--force] | init --list")
  process.exit(2)
}

if (command === "init") {
  const { TEMPLATES, TEMPLATE_NAMES, otherSet } = await import("../templates/index.js")
  const list = () => TEMPLATE_NAMES.map((n) => `  ${n.padEnd(10)} ${TEMPLATES[n].description}`).join("\n")
  if (file === "--list") {
    console.log(`The templates (feather-page init <template>):\n${list()}`)
    process.exit(0)
  }
  if (!file || file.startsWith("--")) {
    console.error(`usage: feather-page init <template> [--out file] [--theme theme.json] [--force]\n\nThe templates:\n${list()}`)
    process.exit(2)
  }
  const template = TEMPLATES[file]
  if (!template) {
    console.error(`feather-page init: there is no template "${file}". The templates:\n${list()}`)
    process.exit(1)
  }
  const out = path.resolve(flag("--out", `${file}.page.json`))
  if (fs.existsSync(out) && !rest.includes("--force")) {
    console.error(`feather-page init: ${path.relative(process.cwd(), out) || out} exists; pass --force to overwrite it`)
    process.exit(1)
  }
  const page = structuredClone(template.page)
  const theme = flag("--theme")
  if (theme) {
    const at = path.resolve(theme)
    if (!fs.existsSync(at)) {
      console.error(`feather-page init: the theme ${theme} does not exist`)
      process.exit(1)
    }
    page.brand = path.relative(path.dirname(out), at).split(path.sep).join("/")
    // The scheme toggle needs the brand's other set: start from the theme's own colours, ground and ink swapped.
    const json = JSON.parse(fs.readFileSync(at, "utf8"))
    if (page.scheme) page.scheme.colors = otherSet((json.tokens ?? json).colors)
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(page, null, 2)}\n`)
  const shown = path.relative(process.cwd(), out) || out
  console.log(`wrote ${shown}: the ${file} template (layout ${page.layout ?? "none"}, loudness ${page.loudness ?? "the brand's"})`)
  if (!theme) console.log(`brand is "${page.brand}", read beside the page: put your feather-tokens file there, or run init again with --theme`)
  console.log(`replace the media/ paths with your pictures, then: feather-page build ${shown} --out site`)
  process.exit(0)
}

if (!command || !file) usage()

const lib = await import("../dist/index.js")
const doc = JSON.parse(fs.readFileSync(file, "utf8"))
const result = lib.validatePage(doc)
if (!result.ok) {
  console.error(`${file} is not a valid feather.page/0 document:`)
  for (const i of result.issues) console.error(`- ${i.path || "/"} ${i.code}: ${i.message}`)
  process.exit(1)
}
const page = result.page
const base = flag("--base", "/")
const routes = pageRoutes(lib, page, base)

if (command === "validate") {
  console.log(`${file}: valid ${page.schema}, ${page.sections.length} sections, ${routes.length - 1} prepared scenes`)
} else if (command === "routes") {
  console.log(JSON.stringify(routes, null, 2))
} else if (command === "build") {
  const out = flag("--out")
  if (!out) usage()
  const tokens = pageTokens(page, file)
  // What the brand's colours cannot carry (a layout's grounds below 4.5:1) is reported like a validation issue.
  const issues = lib.checkLayout(page, tokens)
  if (issues.length) {
    console.error(`${file} cannot be built in its brand:`)
    for (const i of issues) console.error(`- ${i.path} ${i.code}: ${i.message}`)
    process.exit(1)
  }
  const React = await import("react")
  const server = await import("react-dom/server")
  const written = buildPage({ lib, React, server, page, tokens, out, css: flag("--css"), base, runtime: flag("--runtime") })
  console.log(`built ${written} routes into ${out}`)
} else usage()
