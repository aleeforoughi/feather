import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { expect, test, type Browser } from "@playwright/test"

// The release runtime and its block families: pages built by `feather-page build --runtime` with the release's
// feather-page-runtime.js. A plain page downloads none of the families; a page with the product flows downloads the
// flows family (and not the media one); a page with the media blocks the media family. Each hydrates the server's
// markup with no console error (a hydration mismatch is one), and its interactions then work.
const repo = path.join(import.meta.dirname, "../../..")
const release = path.join(repo, "apps/release/dist")
const FAMILIES = ["feather-page-media.js", "feather-page-flows.js", "feather-page-parts.js", "feather-page-three.js"]

test.beforeAll(() => {
  if (!fs.existsSync(path.join(release, "feather-page-flows.js"))) execFileSync("npx", ["vite", "build"], { cwd: path.join(repo, "apps/release"), stdio: "pipe" })
})

/** Builds an example page with the runtime, serves it, opens it, and records the release's chunks it requests. */
async function built(browser: Browser, example: string, brand = "studio") {
  const tmpBase = process.env.TMPDIR && fs.existsSync(process.env.TMPDIR) ? process.env.TMPDIR : path.join(import.meta.dirname, "../node_modules/.cache")
  fs.mkdirSync(tmpBase, { recursive: true })
  const work = fs.mkdtempSync(path.join(tmpBase, "feather-runtime-"))
  const doc = JSON.parse(fs.readFileSync(path.join(repo, "packages/page/examples", example), "utf8"))
  fs.copyFileSync(path.join(repo, `packages/tokens/themes/${brand}.json`), path.join(work, "brand.json"))
  fs.writeFileSync(path.join(work, "page.json"), JSON.stringify({ ...doc, brand: "brand.json" }))
  const css = fs.existsSync(path.join(release, "feather-page.css")) ? ["--css", "/built/assets/feather-page.css"] : []
  execFileSync(process.execPath, [path.join(repo, "packages/page/bin/feather-page.mjs"), "build", path.join(work, "page.json"), "--out", path.join(work, "site"), "--base", "/built/", "--runtime", "/built/assets/feather-page-runtime.js", ...css], { stdio: "pipe" })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors: string[] = []
  const chunks: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
  await context.route(/\/built\//, async (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/built\//, "")
    const file = rel.startsWith("assets/") ? path.join(release, rel.slice("assets/".length)) : rel.startsWith("media/") ? path.join(import.meta.dirname, "../public", rel) : path.join(work, "site", rel || "index.html")
    if (rel.startsWith("assets/") && rel.endsWith(".js")) chunks.push(rel.slice("assets/".length))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" })
    const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".svg") ? "image/svg+xml" : file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream"
    await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { "content-type": type } })
  })
  await page.goto("/built/index.html", { waitUntil: "networkidle" })
  const families = () => chunks.filter((c) => FAMILIES.includes(c))
  const close = async () => {
    await context.close()
    fs.rmSync(work, { recursive: true, force: true })
  }
  return { page, errors, chunks, families, close }
}

test("a plain page loads none of the block families, and hydrates", async ({ browser }) => {
  const { page, errors, chunks, families, close } = await built(browser, "studio-of-one.page.json")
  expect(chunks).toEqual(expect.arrayContaining(["feather-page-runtime.js", "feather-page-shared.js"]))
  expect(families()).toEqual([])
  // Hydrated: the overlay menu opens.
  await page.locator('[data-slot="overlay-menu-toggle"]').click()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(errors).toEqual([])
  await close()
})

test("the flows page loads the flows family before it hydrates, and its flows work", async ({ browser }) => {
  const { page, errors, families, close } = await built(browser, "studio-of-one-flows.page.json")
  expect(families()).toEqual(["feather-page-flows.js"])
  // Hydrated: the work's view switch (a flows part) changes the view.
  const work = page.locator('[data-block="work"][data-view]')
  await expect(work).toHaveAttribute("data-view", "grid")
  await page.locator('[data-slot="view-switch"]').getByText("List").click()
  await expect(work).toHaveAttribute("data-view", "list")
  expect(errors).toEqual([])
  await close()
})

test("the media page loads the media family, and the lightbox only when an image opens", async ({ browser }) => {
  const { page, errors, families, close } = await built(browser, "studio-of-one-media.page.json")
  expect(families()).toEqual(["feather-page-media.js"])
  await page.evaluate(() => document.querySelector("#studio")?.scrollIntoView({ block: "start", behavior: "instant" }))
  await page.locator('#studio [data-slot="reel-item"]:not([data-variant="copy"]) [data-slot="gallery-open"]').first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(families()).toEqual(["feather-page-media.js", "feather-page-parts.js"])
  expect(errors).toEqual([])
  await close()
})

test("mount passes the host's onAsk to the Living Page: pressing a starter no prepared scene answers asks it", async ({ browser }) => {
  // The reference page with no prepared scenes, so every starter goes to the host's model.
  const doc = JSON.parse(fs.readFileSync(path.join(repo, "packages/page/examples/studio-of-one.page.json"), "utf8"))
  const page = { ...doc, brand: "brand.json", living: { ...doc.living, prepared: [] } }
  const tokens = JSON.parse(fs.readFileSync(path.join(repo, "packages/tokens/themes/studio.json"), "utf8")).tokens
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
    import { mount } from "/built/assets/feather-page-runtime.js"
    window.__asks = []
    const onAsk = async function* (ask) { window.__asks.push(ask); yield { type: "word", text: "Noted." }; yield { type: "done" } }
    mount(document.getElementById("root"), ${JSON.stringify(page).replace(/</g, "\\u003c")}, { tokens: ${JSON.stringify(tokens)}, onAsk })
  </script></body></html>`
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const errors: string[] = []
  await context.route(/\/built\//, async (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/built\//, "")
    if (rel === "index.html") return route.fulfill({ status: 200, body: html, headers: { "content-type": "text/html; charset=utf-8" } })
    const file = rel.startsWith("assets/") ? path.join(release, rel.slice("assets/".length)) : path.join(import.meta.dirname, "../public", rel)
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" })
    await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { "content-type": file.endsWith(".js") ? "text/javascript" : "application/octet-stream" } })
  })
  const tab = await context.newPage()
  tab.on("pageerror", (e) => errors.push(e.message))
  await tab.goto("/built/index.html", { waitUntil: "networkidle" })
  const starter = tab.locator('[data-slot="hero-starter"]').first()
  await expect(starter).toBeVisible()
  const ask = (await starter.textContent())!.trim()
  await starter.click()
  await expect.poll(() => tab.evaluate(() => (window as unknown as { __asks: string[] }).__asks)).toEqual([ask])
  expect(errors).toEqual([])
  await context.close()
})
