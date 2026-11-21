#!/usr/bin/env node
// feather-page: websites from a feather.page/0 document.
//
//   feather-page validate <page.json>            every issue, with its JSON pointer; exit 1 when invalid
//   feather-page routes <page.json>              the static routes: the base page and one per prepared scene
//   feather-page build <page.json> --out <dir> [--css <href>] [--base </>]
//                                                writes index.html and <intent>/index.html, readable with no script
//
// `brand` in the page is read relative to the page file: a feather-tokens file, or a reference theme ({ tokens }).
// Deterministic: no network, no model.
import fs from "node:fs"
import path from "node:path"

const [command, file, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(name)
  return i === -1 ? fallback : rest[i + 1]
}
const usage = () => {
  console.error("usage: feather-page validate|routes|build <page.json> [--out dir] [--css href] [--base /]")
  process.exit(2)
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
const scenes = lib.pageScenes(page)
const root = base.endsWith("/") ? base : `${base}/`
const routes = [{ path: root, intent: null, title: page.title ?? "" }, ...scenes.map((s) => ({ path: `${root}${s.intent}`, intent: s.intent, title: s.blocks.find((b) => typeof b.title === "string")?.title ?? s.ask }))]

if (command === "validate") {
  console.log(`${file}: valid feather.page/0, ${page.sections.length} sections, ${scenes.length} prepared scenes`)
} else if (command === "routes") {
  console.log(JSON.stringify(routes, null, 2))
} else if (command === "build") {
  const out = flag("--out")
  if (!out) usage()
  const css = flag("--css")
  const React = await import("react")
  const { renderToStaticMarkup } = await import("react-dom/server")
  let tokens
  if (typeof page.brand === "string") {
    const brand = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), page.brand), "utf8"))
    tokens = brand.tokens ?? brand
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  const html = (title, body) =>
    `<!doctype html>\n<html lang="${esc(page.lang ?? "en")}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n${page.description ? `<meta name="description" content="${esc(page.description)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(page.description)}">\n` : ""}${css ? `<link rel="stylesheet" href="${esc(css)}">\n` : ""}</head>\n<body>\n${body}\n</body>\n</html>\n`
  const href = (intent) => `${root}${intent}`
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, "index.html"), html(page.title ?? "", renderToStaticMarkup(React.createElement(lib.FeatherPage, { page, tokens }))))
  for (const s of scenes) {
    fs.mkdirSync(path.join(out, s.intent), { recursive: true })
    const title = `${s.ask}${page.title ? ` — ${page.title}` : ""}`
    fs.writeFileSync(path.join(out, s.intent, "index.html"), html(title, renderToStaticMarkup(React.createElement(lib.PreparedPage, { page, intent: s.intent, tokens, href }))))
  }
  console.log(`built ${routes.length} routes into ${out}`)
} else usage()
