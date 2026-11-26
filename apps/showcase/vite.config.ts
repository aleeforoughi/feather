import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFile } from "node:fs/promises"
import { defineConfig, type Plugin } from "vite"

// The sites page's own entry (its top-level code mounts the page, so it stays in its entry chunk).
const SITES_ENTRY = /[\\/]src[\\/]sites\.tsx$/
// React, with the bundler's runtime and Vite's preload polyfill (each page needs both, and alone each is a request).
const REACT = /[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:react|react-dom|scheduler)[\\/]|^\0(?:rolldown\/runtime|vite\/modulepreload-polyfill)/

type Info = { importers: readonly string[] } | null
const fromSites = new Map<string, boolean>()
/** True when the sites entry reaches the module through static imports alone (a block family it loads on demand, and
 * whatever only a family uses, are reached through a dynamic import and stay in their own chunks). */
function staticallyFromSites(id: string, info: (id: string) => Info): boolean {
  const known = fromSites.get(id)
  if (known !== undefined) return known
  fromSites.set(id, false)
  const reached = (info(id)?.importers ?? []).some((by) => SITES_ENTRY.test(by) || staticallyFromSites(by, info))
  fromSites.set(id, reached)
  return reached
}

// The sites page's documents: ?page=<name> (the reference page when none), ?template=<name>. Each is served minified as
// pages/<name>.json (pages/template-<name>.json), and sites.html's head starts fetching the one the URL asks for before
// the page's code has loaded, so the page neither waits on a second round trip nor downloads the other nine.
const PAGE = "../../packages/page"
const PAGES: Record<string, string> = {
  reference: `${PAGE}/examples/studio-of-one.page.json`,
  loud: `${PAGE}/examples/studio-of-one-loud.page.json`,
  media: `${PAGE}/examples/studio-of-one-media.page.json`,
  flows: `${PAGE}/examples/studio-of-one-flows.page.json`,
}
const TEMPLATES = ["launch", "studio", "editorial", "service", "product", "creator"]
const DOCUMENTS: Record<string, string> = { ...PAGES, ...Object.fromEntries(TEMPLATES.map((t) => [`template-${t}`, `${PAGE}/templates/${t}.page.json`])) }

function pageDocuments(): Plugin {
  const minified = async (name: string) => JSON.stringify(JSON.parse(await readFile(new URL(DOCUMENTS[name], import.meta.url), "utf8")))
  // An unknown template is an error that names the templates; an unknown ?page is the reference page.
  const fetchScript = `<script>(function(){var q=new URLSearchParams(location.search),t=q.get("template"),p=q.get("page"),T=${JSON.stringify(TEMPLATES)},P=${JSON.stringify(Object.keys(PAGES))};var n=t!==null?(T.indexOf(t)<0?null:"template-"+t):(P.indexOf(p)<0?"reference":p);window.__featherPage=n===null?Promise.reject(new Error("?template="+t+": the templates are "+T.join(", "))):fetch("pages/"+n+".json").then(function(r){if(!r.ok)throw new Error("pages/"+n+".json: "+r.status);return r.json()})})()</script>`
  return {
    name: "feather-showcase-page-documents",
    transformIndexHtml: { order: "pre", handler: (html, ctx) => (ctx.filename.endsWith("sites.html") ? html.replace("</title>", `</title>\n    ${fetchScript}`) : html) },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = /\/pages\/([\w-]+)\.json$/.exec(req.url?.split("?")[0] ?? "")?.[1]
        if (!name || !DOCUMENTS[name]) return next()
        res.setHeader("content-type", "application/json")
        res.end(await minified(name))
      })
    },
    async generateBundle() {
      for (const name of Object.keys(DOCUMENTS)) this.emitFile({ type: "asset", fileName: `pages/${name}.json`, source: await minified(name) })
    },
  }
}

// The showcase consumes the built packages exactly as an outside product would: no aliases into
// packages/*/src, only the published entries of the Feather packages.
export default defineConfig({
  base: "./",
  plugins: [pageDocuments(), react(), tailwindcss()],
  // index.html is the product showcase; sites.html is the website layer (one page schema, three brands); fit.html is
  // the fit gate's stress page (e2e/fit.spec.ts).
  build: {
    rolldownOptions: {
      input: { index: "index.html", sites: "sites.html", fit: "fit.html" },
      output: {
        // The sites page loads in a few requests, as a built page does (the runtime and its shared chunk): its entry,
        // React, and everything else it imports statically. Left to itself the bundler splits that last part at every
        // module a lazy block family also uses, and a phone then queues nine requests before the page can render.
        codeSplitting: {
          groups: [
            { name: "react", test: REACT, priority: 2 },
            { name: (id, ctx) => (!SITES_ENTRY.test(id) && staticallyFromSites(id, (m) => ctx.getModuleInfo(m)) ? "sites-app" : null), priority: 1 },
          ],
        },
      },
    },
  },
})
