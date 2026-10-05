// A static file server for the built docs site, for the e2e suite. Node built-ins only.
//   node e2e/serve.mjs <dir> <port>
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const [dir = "dist", port = "6008"] = process.argv.slice(2)
const root = path.resolve(dir)
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" }

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    let file = path.join(root, decodeURIComponent(url.pathname))
    if (!file.startsWith(root)) return res.writeHead(403).end()
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html")
    if (!fs.existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
    fs.createReadStream(file).pipe(res)
  })
  .listen(Number(port), () => console.log(`Serving ${root} on http://localhost:${port}`))
