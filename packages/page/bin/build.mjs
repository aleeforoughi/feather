// feather-page build, as a function: one direction (a validated page in its brand), every route, written to a folder.
// The CLI calls it once; scripts/render-gate.mjs calls it in a loop, in-process, to hold the 2-CPU render budget.
import fs from "node:fs"
import path from "node:path"

/** The page's routes: the base page, then one per prepared scene. */
export function pageRoutes(lib, page, base = "/") {
  const root = base.endsWith("/") ? base : `${base}/`
  const scenes = lib.pageScenes(page)
  return [{ path: root, intent: null, title: page.title ?? "" }, ...scenes.map((s) => ({ path: `${root}${s.intent}`, intent: s.intent, title: s.blocks.find((b) => typeof b.title === "string")?.title ?? s.ask }))]
}

/** The brand's tokens for a page: inline, or the file `brand` names, read relative to the page file (a feather-tokens
 * file, or a reference theme `{ tokens }`). */
export function pageTokens(page, file) {
  if (typeof page.brand !== "string") return undefined
  const brand = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), page.brand), "utf8"))
  return brand.tokens ?? brand
}

/**
 * Renders every route of a validated page and writes it under `out`: index.html, <intent>/index.html per prepared scene
 * and, with notFound, 404.html. Returns the number of files written. `lib` is the page package, `React` and `server`
 * (react-dom/server) are passed in so a caller loads them once.
 */
export function buildPage({ lib, React, server, page, tokens, out, css, base = "/", runtime }) {
  const { renderToStaticMarkup, renderToString } = server
  const root = base.endsWith("/") ? base : `${base}/`
  const scenes = lib.pageScenes(page)
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
  // Route transitions between the static pages are the browser's own cross-document View Transitions: no script, off
  // under reduced motion. view and push are styled by foundation.css; columns needs script, so a static site fades.
  const transition = page.transition
  const crossDocument = transition !== undefined && transition !== "none"
  const routeAttr = transition === "view" || transition === "push" ? ` data-route-transition="${transition}"` : ""
  const vt = crossDocument ? `<style>@media (prefers-reduced-motion: no-preference){@view-transition{navigation:auto}}</style>\n` : ""
  // The colour scheme toggle (scheme): a remembered light or dark choice goes on <html> before the first paint, so the
  // page never flashes the other scheme. Without script the system's preference holds (the theme's media query).
  const scheme = page.scheme ? `<script>${lib.schemeScript()}</script>\n` : ""
  // With a runtime, the markup is rendered for hydration and wrapped with the data the runtime boots from. JSON in a
  // script is escaped so no "</script>" or "<!--" inside the document can end it.
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
  const render = (element, data) =>
    runtime
      ? `<div data-feather-page-root>${renderToString(element)}</div>\n<script type="application/json" data-feather-page>${json({ ...data, tokens })}</script>\n<script type="module" src="${esc(runtime)}"></script>`
      : renderToStaticMarkup(element)
  const html = (title, body) =>
    `<!doctype html>\n<html lang="${esc(page.lang ?? "en")}"${routeAttr}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${scheme}<title>${esc(title)}</title>\n${page.description ? `<meta name="description" content="${esc(page.description)}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(page.description)}">\n` : ""}${css ? `<link rel="stylesheet" href="${esc(css)}">\n` : ""}${vt}</head>\n<body>\n${body}\n</body>\n</html>\n`
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
  return 1 + scenes.length + (page.notFound ? 1 : 0)
}
