// A static server for the e2e: the host page (e2e/host) at /, the built bundle (dist) at /feather/. Node built-ins only.
//   node e2e/serve.mjs <port>
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const port = Number(process.argv[2] ?? 6010)
const here = path.dirname(new URL(import.meta.url).pathname)
const host = path.join(here, "host")
const dist = path.resolve(here, "..", "dist")
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff" }

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const pathname = decodeURIComponent(url.pathname)
    const [root, rel] = pathname.startsWith("/feather/") ? [dist, pathname.slice("/feather/".length)] : [host, pathname === "/" ? "index.html" : pathname.slice(1)]
    const file = path.join(root, rel)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end()
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`Serving the host page on http://localhost:${port}`))
