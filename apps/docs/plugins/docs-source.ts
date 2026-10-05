// Turns the repository's markdown docs into the site's content at build time. The markdown stays the single source: this
// module renders it, rewrites the links between the documents to the site's routes, and builds the search index. The
// result is the virtual module `virtual:docs`. After the build it also writes one HTML file per route (the app is one
// bundle that reads its page from the URL) and copies the JSON Schemas next to them.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Marked } from "marked"
import type { Plugin } from "vite"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const SCHEMA_DIR = path.join(REPO, "packages/intent/schema")

/** The links in the rendered HTML start with this; the app swaps it for the path back to the site root. */
export const ROOT_TOKEN = "@@ROOT@@"

interface PageSource {
  slug: string
  nav: string
  /** Markdown source relative to the repository, or null for a generated page. */
  src: string | null
  summary: string
}

/** The pages, in nav order. The first is the home page at the site root. */
const PAGES: PageSource[] = [
  { slug: "", nav: "Start here", src: "docs/callers.md", summary: "Render your first experience." },
  { slug: "ir", nav: "The IR", src: "docs/ir/README.md", summary: "What an experience is." },
  { slug: "nodes", nav: "Node reference", src: "docs/ir/nodes.md", summary: "Every node type and field." },
  { slug: "lifecycle", nav: "Lifecycle", src: "docs/lifecycle.md", summary: "Updates, replies and streaming." },
  { slug: "freeze", nav: "The freeze", src: "docs/ir/FREEZE.md", summary: "What feather.ir/1 promises." },
  { slug: "composer", nav: "How Feather decides", src: "docs/composer.md", summary: "The composer and its rules." },
  { slug: "bodies", nav: "Bodies", src: "docs/manifestations.md", summary: "Web, text, voice and switch." },
  { slug: "schemas", nav: "JSON Schemas", src: null, summary: "The schemas, as downloads." },
]

export interface DocHeading {
  id: string
  text: string
  depth: number
}
export interface DocPage {
  slug: string
  /** Path from the site root, "" for the home page. */
  route: string
  nav: string
  title: string
  summary: string
  html: string
  toc: DocHeading[]
}
export interface SchemaFile {
  file: string
  title: string
  id: string
  bytes: number
}
export interface SearchEntry {
  /** What the person searches for. */
  text: string
  page: string
  pageTitle: string
  /** Path from the site root, with the anchor. */
  href: string
  kind: "page" | "heading" | "node" | "schema"
}
export interface DocsData {
  pages: DocPage[]
  schemas: SchemaFile[]
  search: SearchEntry[]
  warnings: string[]
}

const routeOf = (slug: string) => (slug ? `${slug}/` : "")

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
const plain = (html: string) => decode(html.replace(/<[^>]*>/g, "")).trim()

/** GitHub's heading slugs, so anchors written in the markdown keep working. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-")
}

function readSchemas(): SchemaFile[] {
  if (!fs.existsSync(SCHEMA_DIR)) return []
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8")
      const json = JSON.parse(text) as { title?: string; $id?: string }
      return { file, title: json.title ?? file, id: json.$id ?? file, bytes: Buffer.byteLength(text) }
    })
}

export function buildDocs(): DocsData {
  const warnings: string[] = []
  const schemas = readSchemas()
  const bySrc = new Map(PAGES.filter((p) => p.src).map((p) => [p.src as string, p]))

  /** Where a markdown link goes on the site, or null when it points outside the documents. */
  function rewrite(href: string, from: string): string | null {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("#")) return href
    const [file = "", hash] = href.split("#")
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), file))
    const suffix = hash ? `#${hash}` : ""
    const page = bySrc.get(target)
    if (page) return `${ROOT_TOKEN}${routeOf(page.slug)}${suffix}`
    const schema = schemas.find((s) => target === `packages/intent/schema/${s.file}`)
    if (schema) return `${ROOT_TOKEN}schema/${schema.file}`
    warnings.push(`${from}: link "${href}" points outside the documents (${target}); rendered without a link`)
    return null
  }

  const pages: DocPage[] = []
  const search: SearchEntry[] = []

  for (const source of PAGES) {
    if (!source.src) continue
    const from = source.src
    const toc: DocHeading[] = []
    const used = new Map<string, number>()
    const marked = new Marked({
      gfm: true,
      renderer: {
        heading({ tokens, depth }) {
          const inner = this.parser.parseInline(tokens)
          const text = plain(inner)
          const base = slugify(text) || "section"
          const n = used.get(base) ?? 0
          used.set(base, n + 1)
          const id = n === 0 ? base : `${base}-${n}`
          toc.push({ id, text, depth })
          const anchor = `<a class="anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a>`
          return `<h${depth} id="${id}">${inner} ${anchor}</h${depth}>\n`
        },
        link({ href, title, tokens }) {
          const inner = this.parser.parseInline(tokens)
          const to = rewrite(href, from)
          if (to === null) return `<span class="unlinked">${inner}</span>`
          const external = /^[a-z][a-z0-9+.-]*:/i.test(to)
          const t = title ? ` title="${escapeHtml(title)}"` : ""
          return `<a href="${escapeHtml(to)}"${t}${external ? ' rel="noopener noreferrer"' : ""}>${inner}</a>`
        },
        code({ text, lang }) {
          const language = (lang ?? "").split(/\s/)[0] ?? ""
          const cls = language ? ` class="language-${escapeHtml(language)}"` : ""
          return `<div class="code-block" data-language="${escapeHtml(language || "text")}"><button type="button" class="copy-button" data-copy>Copy</button><pre tabindex="0"><code${cls}>${escapeHtml(text)}</code></pre></div>\n`
        },
      },
    })
    const raw = fs.readFileSync(path.join(REPO, from), "utf8")
    const html = (marked.parse(raw, { async: false }) as string)
      // A header cell the author left empty still needs a name for a screen reader.
      .replace(/<th([^>]*)>\s*<\/th>/g, '<th$1><span class="sr-only">Details</span></th>')
      .replace(/<table>/g,'<div class="table-wrap" tabindex="0"><table>')
      .replace(/<\/table>/g, "</table></div>")
    const title = toc.find((h) => h.depth === 1)?.text ?? source.nav
    const route = routeOf(source.slug)
    pages.push({ slug: source.slug, route, nav: source.nav, title, summary: source.summary, html, toc: toc.filter((h) => h.depth >= 2 && h.depth <= 3) })

    search.push({ text: source.nav, page: source.slug, pageTitle: source.nav, href: route, kind: "page" })
    for (const h of toc) {
      if (h.depth === 1) continue
      // The node reference's third level is the node types: the names a caller searches for.
      const kind = source.slug === "nodes" && h.depth === 3 ? "node" : "heading"
      search.push({ text: h.text, page: source.slug, pageTitle: source.nav, href: `${route}#${h.id}`, kind })
    }
  }

  const schemasPage = PAGES.find((p) => p.slug === "schemas")!
  pages.push({ slug: "schemas", route: "schemas/", nav: schemasPage.nav, title: "JSON Schemas", summary: schemasPage.summary, html: "", toc: [] })
  search.push({ text: "JSON Schemas", page: "schemas", pageTitle: schemasPage.nav, href: "schemas/", kind: "page" })
  for (const s of schemas) search.push({ text: s.file, page: "schemas", pageTitle: schemasPage.nav, href: "schemas/", kind: "schema" })

  // The generated page keeps its place in the nav order.
  pages.sort((a, b) => PAGES.findIndex((p) => p.slug === a.slug) - PAGES.findIndex((p) => p.slug === b.slug))
  return { pages, schemas, search, warnings }
}

const VIRTUAL = "virtual:docs"
const RESOLVED = `\0${VIRTUAL}`

export function docsSource(): Plugin {
  let outDir = "dist"
  let root = process.cwd()
  return {
    name: "feather-docs-source",
    configResolved(config) {
      outDir = config.build.outDir
      root = config.root
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined
    },
    load(id) {
      if (id !== RESOLVED) return undefined
      const data = buildDocs()
      for (const w of data.warnings) this.warn(w)
      // The sources are watched, so `docs:dev` follows an edit to a document.
      for (const p of PAGES) if (p.src) this.addWatchFile(path.join(REPO, p.src))
      return `export default ${JSON.stringify(data)}`
    },
    generateBundle() {
      for (const file of readSchemas().map((s) => s.file)) {
        this.emitFile({ type: "asset", fileName: `schema/${file}`, source: fs.readFileSync(path.join(SCHEMA_DIR, file)) })
      }
    },
    closeBundle: {
      order: "post",
      handler() {
        // One file per route, so the site is plain static files. A nested page reaches the bundle one level up.
        const dist = path.resolve(root, outDir)
        const indexFile = path.join(dist, "index.html")
        if (!fs.existsSync(indexFile)) return
        const home = fs.readFileSync(indexFile, "utf8")
        const data = buildDocs()
        const withTitle = (html: string, title: string) => html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)} | Feather docs</title>`)
        for (const page of data.pages) {
          const html = page.slug ? home.replace(/(["'(])\.\/assets\//g, "$1../assets/") : home
          const dir = page.slug ? path.join(dist, page.slug) : dist
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, "index.html"), withTitle(html, page.title))
        }
      },
    },
    configureServer(server) {
      // The schemas, for the dev server (a build copies them).
      server.middlewares.use("/schema", (req, res, next) => {
        const file = path.join(SCHEMA_DIR, path.basename((req.url ?? "").split("?")[0] ?? ""))
        if (!file.endsWith(".json") || !fs.existsSync(file)) return next()
        res.setHeader("content-type", "application/json")
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}
