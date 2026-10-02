// Renders the product to PNGs in .qooe-shots/ with the sandbox's offline headless Chromium.
// Runs inside the pinned browser image: no network, read-only root, scratch space in /tmp.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const out = path.join(root, ".qooe-shots")
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH || "/ms-playwright"
const scratch = fs.mkdtempSync("/tmp/qooe-shot-")

function findChromium() {
  const dir = fs.readdirSync(browsers).find((d) => d.startsWith("chromium_headless_shell-"))
  if (!dir) throw new Error(`no headless chromium under ${browsers}`)
  const base = path.join(browsers, dir)
  for (const sub of fs.readdirSync(base)) {
    const bin = path.join(base, sub, "headless_shell")
    if (fs.existsSync(bin)) return bin
  }
  throw new Error(`no headless_shell under ${base}`)
}

const chromium = findChromium()
let written = 0
let failed = 0

function shoot(name, url, width, height) {
  const file = path.join(out, name)
  fs.rmSync(file, { force: true })
  const res = spawnSync(
    chromium,
    [
      "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
      "--allow-file-access-from-files", "--force-device-scale-factor=1",
      `--user-data-dir=${path.join(scratch, "profile")}`,
      `--window-size=${width},${height}`, "--virtual-time-budget=4000",
      `--screenshot=${file}`, url,
    ],
    { encoding: "utf8", timeout: 60_000, env: { ...process.env, HOME: scratch } },
  )
  if (!fs.existsSync(file)) {
    failed += 1
    console.error(`FAILED ${name}: ${(res.stderr || res.error?.message || "no output").toString().slice(-400)}`)
    return
  }
  written += 1
  console.log(`wrote .qooe-shots/${name} (${width}x${height})`)
}

function logo(name, size) {
  const png = path.join(root, "brand", "logo.png")
  const html = path.join(scratch, `${name}.html`)
  fs.writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:#f4f4f5}body{display:flex;align-items:center;justify-content:center}img{max-width:80%;max-height:80%;width:${Math.round(size * 0.8)}px;height:${Math.round(size * 0.8)}px;object-fit:contain}</style><img src="file://${png}">`,
  )
  shoot(name, `file://${html}`, size, size)
}

fs.mkdirSync(out, { recursive: true })
if (fs.existsSync(path.join(root, "brand", "logo.png"))) {
  logo("logo.png", 512)
  logo("logo-small.png", 64)
}
const dist = path.join(root, "dist", "index.html")
// The themed component sheet (Feather branch) — tall frames so every component is in view.
const sheet = path.join(root, "dist", "sheet.html")
if (fs.existsSync(sheet)) {
  shoot("sheet-390.png", `file://${sheet}`, 390, 2400)
  shoot("sheet-1280.png", `file://${sheet}`, 1280, 1600)
}
/**
 * The whole page, top to bottom (capped), so QA and the developer see every section — a window-sized
 * shot hides everything below the fold. Uses the installed playwright-core driving the same offline
 * headless Chromium; falls back to a window-sized shot if it is unavailable.
 */
async function shootPage(name, url, width, height) {
  let chromiumApi = null
  try {
    chromiumApi = (await import("playwright-core")).chromium
  } catch {
    chromiumApi = null
  }
  if (!chromiumApi) return shoot(name, url, width, height)
  const file = path.join(out, name)
  fs.rmSync(file, { force: true })
  let browser = null
  try {
    browser = await chromiumApi.launch({ executablePath: chromium, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--allow-file-access-from-files"], env: { ...process.env, HOME: scratch } })
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: "load", timeout: 30_000 })
    await page.waitForTimeout(1_500)
    const full = await page.evaluate(() => document.documentElement.scrollHeight)
    const clipHeight = Math.min(full, 6_000)
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height: clipHeight } })
    written += 1
    console.log(`wrote .qooe-shots/${name} (${width}x${clipHeight}, full page${full > clipHeight ? `, first ${clipHeight} of ${full}px` : ""})`)
  } catch (err) {
    console.error(`full-page ${name} failed (${String(err).slice(0, 200)}); falling back to the window`)
    shoot(name, url, width, height)
  } finally {
    await browser?.close().catch(() => {})
  }
}

if (fs.existsSync(dist) && !/QOOE is building this product\./.test(fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8"))) {
  // A web app lists its screens (design/screens.json: {"screens":[{"name":"projects","path":"/projects"}]});
  // each renders from the built files by hash route. A single page is just "home".
  let screens = [{ name: "home", path: "/" }]
  try {
    const listed = JSON.parse(fs.readFileSync(path.join(root, "design", "screens.json"), "utf8")).screens
    if (Array.isArray(listed) && listed.length > 0) screens = listed.filter((x) => /^[a-z0-9-]{1,40}$/.test(x.name) && typeof x.path === "string" && x.path.startsWith("/")).slice(0, 24)
  } catch {
    // no screen list: the home page only
  }
  for (const screen of screens) {
    const url = screen.path === "/" ? `file://${dist}` : `file://${dist}#${screen.path}`
    await shootPage(`${screen.name}-390.png`, url, 390, 844)
    await shootPage(`${screen.name}-1280.png`, url, 1280, 800)
  }
}
fs.rmSync(scratch, { recursive: true, force: true })
if (written === 0 || failed > 0) {
  console.error(written === 0 ? "nothing rendered: need brand/logo.png or a built dist/index.html" : `${failed} render(s) failed`)
  process.exit(1)
}
