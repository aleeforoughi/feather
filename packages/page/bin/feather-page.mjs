#!/usr/bin/env node
// feather-page: websites from a feather.page/0 or /1 document.
//
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
  console.log(`${file}: valid ${page.schema}, ${page.sections.length} sections, ${scenes.length} prepared scenes`)
} else if (command === "routes") {
  console.log(JSON.stringify(routes, null, 2))
} else if (command === "build") {
  const out = flag("--out")
  if (!out) usage()
  const css = flag("--css")
  const runtime = flag("--runtime")
  const React = await import("react")
  const { renderToStaticMarkup, renderToString } = await import("react-dom/server")
  let tokens
  if (typeof page.brand === "string") {
    const brand = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), page.brand), "utf8"))
    tokens = brand.tokens ?? brand
  }
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  // Route transitions between the static pages are the browser's own cross-document View Transitions: no script, off
  // under reduced motion. view and push are styled by foundation.css; columns needs script, so a static site fades.
  const transition = page.transition
  const crossDocument = transition !== undefined && transition !== "none"
  const routeAttr = transition === "view" || transition === "push" ? ` data-route-transition="${transition}"` : ""
  const vt = crossDocument ? `<style>@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}}</style>\n` : ""
  // With a runtime, the markup is rendered for hydration and wrapped with the data the runtime boots from. JSON in a
  // script is escaped so no "</script>" or "<!--" inside the document can end it.
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
  const render = (element, data) =>
    runtime
      ? `<div data-feather-page-root>${renderToString(element)}</div>\n<script type="application/json" data-feather-page>${json({ ...data, tokens })}</script>\n<script type="module" src="${esc(runtime)}"></script>`
      : renderToStaticMarkup(element)
  const html = (title, body) =>
    `<!doctype html>\n<html lang="${esc(page.lang ?? "en")}"${routeAttr}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n${page.description ? `<meta name="description" content="${esc(page.description)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(page.description)}">\n` : ""}${css ? `<link rel="stylesheet" href="${esc(css)}">\n` : ""}${vt}</head>\n<body>\n${body}\n</body>\n</html>\n`
  const href = (intent) => `${root}${intent}`
  fs.mkdirSync(out, { recursive: true })
  // A static build has no runtime to mount the loader (it would hold at 0%), so the static pages never carry it. With
  // --runtime the base page keeps it: the runtime runs it.
  const { loader: _loader, ...staticPage } = page
  void _loader
  const basePage = runtime ? page : staticPage
  fs.writeFileSync(path.join(out, "index.html"), html(page.title ?? "", render(React.createElement(lib.FeatherPage, { page: basePage, tokens }), { page: basePage })))
  for (const s of scenes) {
    fs.mkdirSync(path.join(out, s.intent), { recursive: true })
    const title = `${s.ask}${page.title ? ` — ${page.title}` : ""}`
    fs.writeFileSync(path.join(out, s.intent, "index.html"), html(title, render(React.createElement(lib.PreparedPage, { page: staticPage, intent: s.intent, tokens, href }), { page: staticPage, intent: s.intent, base: root })))
  }
  if (page.notFound) {
    const title = `${page.notFound.title ?? "Not found"}${page.title ? ` — ${page.title}` : ""}`
    fs.writeFileSync(path.join(out, "404.html"), html(title, render(React.createElement(lib.PageNotFound, { page: staticPage, tokens }), { page: staticPage, notFound: true })))
  }
  console.log(`built ${routes.length + (page.notFound ? 1 : 0)} routes into ${out}`)
} else usage()
