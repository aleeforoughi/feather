// Renders every page under source/ that names an output: a PNG at its exact size, or a PDF of its
// <section class="page"> pages plus a preview PNG per page in .qooe/pages/. Runs in the pinned browser
// image with its offline headless Chromium: no network, scratch space in /tmp.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { foreignOwner, pageTarget, readManifest, reportFile, sourcePages } from "./lib.mjs"

const root = process.cwd()
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH || "/ms-playwright"
const scratch = fs.mkdtempSync("/tmp/qooe-render-")
const previews = path.join(root, ".qooe", "pages")

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

function chrome(args, url) {
  return spawnSync(
    chromium,
    ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", `--user-data-dir=${path.join(scratch, "profile")}`, "--virtual-time-budget=6000", "--run-all-compositor-stages-before-draw", ...args, url],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, HOME: scratch } },
  )
}

/** A temporary copy of the page beside it (so its relative links work) with QOOE's page rules injected. */
function withRules(t, css, script = "") {
  const inject = `<style data-qooe>${css}</style>${script ? `<script data-qooe>${script}</script>` : ""}`
  const body = /<head[^>]*>/i.test(t.html) ? t.html.replace(/<head[^>]*>/i, (m) => `${m}${inject}`) : `${inject}${t.html}`
  const tmp = path.join(root, path.dirname(t.rel), `.render-${path.basename(t.rel)}`)
  fs.writeFileSync(tmp, body)
  return tmp
}

const pageCss = (w, h) => `@page{size:${w}px ${h}px;margin:0}html,body{margin:0!important;padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}section.page{width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;break-after:page;page-break-after:always;position:relative}`

const pngCss = (w, h) => `html,body{margin:0!important;padding:0!important;width:${w}px;height:${h}px;overflow:hidden}`

/** Runs inside the page (stringified and injected): measures the layout and leaves a JSON report as the
 *  only thing in the DOM, so --dump-dom stays small. Self-contained: it cannot see anything outside it. */
async function measureLayout(opt) {
  const out = { kind: opt.kind, width: opt.w, height: opt.h, pages: [] }
  const r1 = (n) => Math.round(n * 10) / 10
  const sample = (s) => { s = s.replace(/\s+/g, " ").trim(); return s.length > 40 ? `${s.slice(0, 39)}…` : s }
  const rgba = (c) => { const m = /^rgba?\(/.test(c) ? c.match(/[\d.]+/g) : null; return m && m.length >= 3 ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null }
  const hex = (c) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
  const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] }
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
  const tag = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "")
  const add = (list, item) => { const k = JSON.stringify(item); if (list.length < 20 && !list.some((x) => JSON.stringify(x) === k)) list.push(item) }
  const area = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top)
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|emoji|math|fangsong)$/i
  const fontMemo = new Map()
  // document.fonts.check() says "yes" for any family that has no @font-face, so declared faces are checked by
  // load status and system fonts by whether the family changes the width of a test string.
  const fontOk = (f) => {
    if (!fontMemo.has(f)) {
      const faces = [...document.fonts].filter((x) => x.family.replace(/["']/g, "") === f)
      const ctx = document.createElement("canvas").getContext("2d")
      const w = (font) => { ctx.font = `72px ${font}`; return ctx.measureText("mmmmmmmmmmlliWQ@").width }
      fontMemo.set(f, faces.length ? faces.some((x) => x.status === "loaded") : ["monospace", "serif", "sans-serif"].some((g) => w(`"${f}",${g}`) !== w(g)))
    }
    return fontMemo.get(f)
  }
  // Effective background under a text node: the stack of elements at its point, from its element down.
  // An image, video or background-image behind it means the colour cannot be known: null.
  const backdrop = (el, rect) => {
    const stack = document.elementsFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2)
    let chain = stack.indexOf(el) >= 0 ? stack.slice(stack.indexOf(el)) : []
    if (!chain.length) for (let e = el; e; e = e.parentElement) chain.push(e)
    const layers = []
    for (const e of chain) {
      const cs = getComputedStyle(e)
      if (e !== el && /^(img|video|canvas|picture|svg)$/i.test(e.tagName)) return null
      if (cs.backgroundImage !== "none") return null
      const c = rgba(cs.backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    return layers.reduceRight((under, c) => over(c, under), [255, 255, 255, 1])
  }
  try {
    await document.fonts.ready
    const pdf = opt.kind === "pdf"
    const pageEls = pdf ? [...document.querySelectorAll("section.page")] : [document.documentElement]
    for (const [i, pageEl] of pageEls.entries()) {
      if (pdf) window.scrollTo(0, pageEl.getBoundingClientRect().top + window.scrollY) // elementsFromPoint needs the page on screen
      const P = pdf ? pageEl.getBoundingClientRect() : { left: 0, top: 0, right: opt.w, bottom: opt.h }
      const rep = { page: i + 1, textBelowMin: [], lowContrast: [], outOfBounds: [], overlaps: [], clipped: [], missingImages: [], fontFallback: [] }
      const outside = (b) => {
        const by = { left: P.left - b.left, right: b.right - P.right, top: P.top - b.top, bottom: b.bottom - P.bottom }
        for (const k of Object.keys(by)) if (by[k] <= 2) delete by[k]; else by[k] = Math.round(by[k])
        return Object.keys(by).length ? by : null
      }
      const containers = new Map()
      const walker = document.createTreeWalker(pdf ? pageEl : document.body, NodeFilter.SHOW_TEXT)
      for (let node; (node = walker.nextNode()); ) {
        const el = node.parentElement
        const text = sample(node.textContent)
        if (!text || !el || /^(script|style|noscript|template)$/i.test(el.tagName) || el.closest('[aria-hidden="true"]')) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
        if (!rects.length) continue
        const box = range.getBoundingClientRect()
        const px = parseFloat(cs.fontSize)
        if (px < 14) add(rep.textBelowMin, { px: r1(px), text }) // verify applies the minimum for the deliverable's type
        const by = outside(box)
        if (by) add(rep.outOfBounds, { kind: "text", text, by })
        const family = cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "")
        if (family && !generic.test(family) && !fontOk(family) && !rep.fontFallback.some((x) => x.family === family)) rep.fontFallback.push({ family, text })
        const fg = rgba(cs.color)
        if (fg && !el.closest("svg")) {
          let alpha = fg[3]
          for (let e = el; e; e = e.parentElement) alpha *= +getComputedStyle(e).opacity
          const bg = backdrop(el, rects[0])
          if (bg) {
            const c = over([fg[0], fg[1], fg[2], alpha], bg)
            const [hi, lo] = [lum(c), lum(bg)].sort((a, b) => b - a)
            const ratio = (hi + 0.05) / (lo + 0.05)
            const required = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5
            if (ratio < required) add(rep.lowContrast, { ratio: Math.round(ratio * 100) / 100, required, px: r1(px), color: hex(c), background: hex(bg), text })
          }
        }
        const c = containers.get(el) ?? { el, text, rects: [] }
        c.rects.push(...rects)
        containers.set(el, c)
      }
      const list = [...containers.values()].slice(0, 400)
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        if (list[a].el.contains(list[b].el) || list[b].el.contains(list[a].el)) continue
        let worst = 0
        for (const ra of list[a].rects) for (const rb of list[b].rects) {
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
          if (w > 0 && h > 0) worst = Math.max(worst, (w * h) / Math.min(area(ra), area(rb)))
        }
        if (worst > 0.25) add(rep.overlaps, { a: list[a].text, b: list[b].text, percent: Math.round(worst * 100) })
      }
      for (const img of pageEl.querySelectorAll("img")) {
        if (getComputedStyle(img).display === "none") continue
        const src = (img.getAttribute("src") ?? "").slice(0, 80)
        if (img.complete && img.naturalWidth === 0) add(rep.missingImages, { src })
        const b = img.getBoundingClientRect()
        let cropped = false // an image deliberately cropped by an overflow:hidden frame is not out of bounds
        for (let e = img.parentElement; e && e !== pageEl && e !== document.body; e = e.parentElement) if (/hidden|clip/.test(getComputedStyle(e).overflow)) cropped = true
        const by = b.width > 0 && !cropped ? outside(b) : null
        if (by) add(rep.outOfBounds, { kind: "image", text: src, by })
      }
      for (const el of pageEl.querySelectorAll("*")) {
        const cs = getComputedStyle(el)
        if (!/hidden|clip/.test(cs.overflowX + cs.overflowY) || !el.clientWidth || !el.textContent.trim()) continue
        const dx = el.scrollWidth - el.clientWidth
        const dy = el.scrollHeight - el.clientHeight
        if (dx > 2 || dy > 2) add(rep.clipped, { el: tag(el), text: sample(el.textContent), overflowX: Math.max(0, dx), overflowY: Math.max(0, dy) })
      }
      out.pages.push(rep)
    }
  } catch (err) {
    out.error = String(err)
  }
  const s = document.createElement("script")
  s.type = "application/json"
  s.id = "qooe-report"
  s.textContent = JSON.stringify(out).replace(/</g, "\\u003c")
  document.documentElement.replaceChildren(s)
}

/** One extra Chromium pass on a copy of the page with the measuring script; saves .qooe/report/<output>.json. */
function measure(t, css, temps) {
  const pdf = t.output.endsWith(".pdf")
  const opt = { kind: pdf ? "pdf" : "png", w: t.width, h: t.height }
  const tmp = withRules(t, css, `window.addEventListener("load",()=>(${measureLayout.toString()})(${JSON.stringify(opt)}))`)
  temps.push(tmp)
  const res = chrome([`--window-size=${t.width},${t.height}`, "--dump-dom"], `file://${tmp}`)
  const json = /<script type="application\/json" id="qooe-report">([\s\S]*?)<\/script>/.exec(res.stdout ?? "")?.[1]
  let report = null
  try {
    report = JSON.parse(json ?? "")
  } catch {}
  if (!report || report.error) return console.warn(`warning: no layout report for ${t.output}: ${report?.error ?? (res.stderr || "measurement did not finish").toString().slice(-200)}`)
  const file = path.join(root, reportFile(t.output))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ output: t.output, ...report }, null, 2))
  const n = report.pages.reduce((sum, p) => sum + Object.entries(p).filter(([k]) => Array.isArray(p[k])).reduce((m, [, v]) => m + v.length, 0), 0)
  console.log(`report ${reportFile(t.output)} (${n} findings before thresholds)`)
}

const manifest = readManifest()
let written = 0
const failures = []
for (const rel of sourcePages()) {
  const t = pageTarget(rel)
  if (!t) continue
  if (t.error) {
    failures.push(t.error)
    continue
  }
  // One task never overwrites another task's deliverable.
  const owner = foreignOwner(manifest, rel, t.output)
  if (owner) {
    console.warn(`warning: skipped ${rel}: it declares ${t.output}, which belongs to ${owner.title} (made from ${owner.sources.join(", ")}); remove its qooe:output meta or ask that task's owner`)
    continue
  }
  const out = path.join(root, t.output)
  fs.rmSync(path.join(root, reportFile(t.output)), { force: true })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.rmSync(out, { force: true })
  const temps = []
  try {
    if (t.output.endsWith(".png")) {
      const tmp = withRules(t, pngCss(t.width, t.height))
      temps.push(tmp)
      const res = chrome([`--window-size=${t.width},${t.height}`, `--screenshot=${out}`], `file://${tmp}`)
      if (!fs.existsSync(out)) failures.push(`${rel} → ${t.output}: ${(res.stderr || res.error?.message || "no output").toString().slice(-300)}`)
      else {
        written += 1
        console.log(`rendered ${t.output} (${t.width}x${t.height}) from ${rel}`)
        measure(t, pngCss(t.width, t.height), temps)
      }
      continue
    }
    if (t.pages === 0) {
      failures.push(`${rel}: a PDF page source needs <section class="page"> elements, one per page`)
      continue
    }
    const tmp = withRules(t, pageCss(t.width, t.height))
    temps.push(tmp)
    const res = chrome([`--print-to-pdf=${out}`, "--no-pdf-header-footer", "--print-to-pdf-no-header"], `file://${tmp}`)
    if (!fs.existsSync(out)) {
      failures.push(`${rel} → ${t.output}: ${(res.stderr || res.error?.message || "no output").toString().slice(-300)}`)
      continue
    }
    written += 1
    console.log(`rendered ${t.output} (${t.pages} pages of ${t.width}x${t.height}) from ${rel}`)
    // One preview per page, for the crew, QA and the owner to look at.
    const base = path.basename(t.output, ".pdf")
    fs.mkdirSync(previews, { recursive: true })
    for (const old of fs.readdirSync(previews)) if (old.startsWith(`${base}-p`)) fs.rmSync(path.join(previews, old), { force: true })
    for (let i = 1; i <= t.pages; i++) {
      const only = `document.addEventListener("DOMContentLoaded",()=>{document.querySelectorAll("section.page").forEach((p,j)=>{if(j!==${i - 1})p.style.display="none"})})`
      const one = withRules(t, pageCss(t.width, t.height), only)
      temps.push(one)
      const file = path.join(previews, `${base}-p${i}.png`)
      chrome([`--window-size=${t.width},${t.height}`, `--screenshot=${file}`], `file://${one}`)
      if (fs.existsSync(file)) console.log(`  preview .qooe/pages/${base}-p${i}.png`)
      else failures.push(`${rel}: preview of page ${i} failed`)
    }
    measure(t, pageCss(t.width, t.height), temps)
  } finally {
    for (const tmp of temps) fs.rmSync(tmp, { force: true })
  }
}

if (written === 0 && failures.length === 0) console.log('Nothing to render: pages need <meta name="qooe:output"> and <meta name="qooe:size">.')
if (failures.length > 0) {
  console.error(`Render failed:\n${failures.map((f) => `- ${f}`).join("\n")}`)
  process.exit(1)
}
