// The measurements, run inside the page. `install(consts)` is serialized by Playwright and evaluated in the browser,
// so it must stay self-contained: no imports, no references to anything outside its own body. It defines
// `window.__audit`, whose methods return plain failure objects.
//
// Methods that matter for how the gate cannot be fooled:
// - Hit areas (targets.size) are the union of the element's border box and its ::before / ::after boxes, computed from
//   their resolved inset, size, margin and translate / transform. A pseudo box counts only if it has content, is
//   absolutely positioned, has pointer-events other than none and is not clipped by an overflow ancestor (the
//   element itself included). Each side an extension reaches is then confirmed with elementsFromPoint, one pixel inside
//   the outer edge at that side's midpoint: if another element is on top there, that side does not count. A point
//   outside the viewport cannot be tested and is trusted. The result is a bounding union, not an L-shaped region.
// - Layout shift compares every box (scroll-compensated, with transforms neutralized, so a 1px hover lift or a press
//   scale, which section 10 allows, is not counted) before and after each hover and focus. Elements that did not exist
//   before the interaction (a tooltip) are ignored.
// - Elements that are screen-reader-only (1 x 1, clipped) or hidden inputs are skipped everywhere: they have no box.

export interface Consts {
  controlSlots: string[]
  controlHeights: number[]
  sizeHeights: Record<string, number>
  interactive: string
  target: number
  typeSizes: number[]
  weights: number[]
  lineGrid: number
  iconSizes: number[]
  borderWidths: number[]
  focus: { width: number; offset: number }
  curve: string
}

export interface StaticOpts {
  density: string
  expectedHeight: number
  /** One step of the radius hierarchy (0 in the sharp shape). */
  radiusStep: number
  /** The control height of each density: an element inside a nearer [data-density] (a plan's own) follows it. */
  densityHeights: Record<string, number>
  radii: number[]
  durations: number[]
}

export interface Failure {
  rule: string
  property: string
  /** Properties named by the failure, for the exceptions file (pixels.whole lists each offending one). */
  properties?: string[]
  slot: string
  selector: string
  expected: string
  actual: string
}

export interface InteractiveRef {
  id: number
  slot: string
  selector: string
}

export interface AuditApi {
  setDensity(density: string): void
  settle(): Promise<void>
  static(o: StaticOpts): Failure[]
  motion(o: StaticOpts): Failure[]
  reduced(): Failure[]
  interactive(): InteractiveRef[]
  prepare(id: number): { x: number; y: number } | null
  baseline(): void
  compare(rule: string, triggerId: number | null): Failure[]
  focusCheck(): { end: boolean; failures: Failure[] }
  focusById(id: number): boolean
  blur(): void
}

declare global {
  interface Window {
    __audit?: AuditApi
  }
}

export function install(c: Consts): void {
  const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE"])
  const ids = new Map<Element, number>()
  const byId = new Map<number, Element>()
  let nextId = 1
  const idOf = (el: Element): number => {
    let id = ids.get(el)
    if (id === undefined) {
      id = nextId++
      ids.set(el, id)
      byId.set(id, el)
    }
    return id
  }
  const cs = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo)
  const px = (v: string): number => parseFloat(v)
  const near = (a: number, b: number, t = 0.01) => Math.abs(a - b) <= t
  const f2 = (n: number) => String(Math.round(n * 100) / 100)
  const inList = (n: number, list: number[], t = 0.01) => list.some((x) => near(n, x, t))

  function splitTop(s: string): string[] {
    const out: string[] = []
    let depth = 0
    let cur = ""
    for (const ch of s) {
      if (ch === "(") depth++
      if (ch === ")") depth--
      if (ch === "," && depth === 0) {
        out.push(cur.trim())
        cur = ""
      } else cur += ch
    }
    if (cur.trim()) out.push(cur.trim())
    return out
  }
  function times(s: string): number[] {
    return s.split(",").map((t) => {
      const v = t.trim()
      return v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000
    })
  }

  const rect = (el: Element) => el.getBoundingClientRect()
  function srOnly(el: Element): boolean {
    const r = rect(el)
    const s = cs(el)
    if ((r.width <= 1.01 && r.height <= 1.01) && (s.position === "absolute" || s.position === "fixed")) return true
    if (s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)") return true
    return el.matches('input[aria-hidden="true"]')
  }
  function rendered(el: Element): boolean {
    const r = rect(el)
    if (r.width <= 0 || r.height <= 0) return false
    const s = cs(el)
    return s.visibility !== "hidden" && s.display !== "none"
  }
  const vis = (el: Element) => rendered(el) && !srOnly(el)
  function all(): Element[] {
    return Array.from(document.body.querySelectorAll("*")).filter(
      (el) => !SKIP.has(el.tagName) && !(el instanceof SVGElement && !(el instanceof SVGSVGElement)) && !el.closest("#storybook-docs"),
    )
  }
  const visible = () => all().filter(vis)

  function segment(el: Element): string {
    let s = el.tagName.toLowerCase()
    const slot = el.getAttribute("data-slot")
    if (slot) s += `[data-slot=${slot}]`
    else if (el.id) s += `#${el.id}`
    else if (typeof el.className === "string" && el.className.trim()) s += `.${el.className.trim().split(/\s+/)[0]}`
    const p = el.parentElement
    if (p) {
      const same = Array.from(p.children).filter((x) => x.tagName === el.tagName)
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(el) + 1})`
    }
    return s
  }
  function selector(el: Element): string {
    const parts: string[] = []
    let cur: Element | null = el
    for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
      parts.unshift(segment(cur))
      cur = cur.parentElement
    }
    return parts.join(" > ")
  }
  function slotOf(el: Element): string {
    const own = el.getAttribute("data-slot")
    if (own) return own
    const up = el.closest("[data-slot]")
    return up ? `~${up.getAttribute("data-slot")}` : "(none)"
  }
  const make = (rule: string, property: string, el: Element, expected: string, actual: string, suffix = ""): Failure => ({
    rule,
    property,
    slot: slotOf(el),
    selector: selector(el) + suffix,
    expected,
    actual,
  })

  function ownText(el: Element): boolean {
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && (n.textContent ?? "").trim()) return true
    return false
  }
  function srWithin(start: Element, stop: Element): boolean {
    for (let cur: Element | null = start; cur; cur = cur.parentElement) {
      if (srOnly(cur)) return true
      if (cur === stop) break
    }
    return false
  }
  function visibleText(el: Element): string {
    let s = ""
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = (n.textContent ?? "").trim()
      if (!t) continue
      const p = n.parentElement
      if (p && srWithin(p, el)) continue
      s += t
    }
    return s
  }

  // ---- controls -----------------------------------------------------------------------------------------------
  const TEXT_INPUT = /^(checkbox|radio|range|file|hidden|color|image|button|submit|reset)$/
  function isControl(el: Element): boolean {
    const slot = el.getAttribute("data-slot")
    if (el instanceof HTMLInputElement && TEXT_INPUT.test(el.type)) return false
    if (slot) return c.controlSlots.includes(slot)
    if (el.matches("button, select")) return true
    return el instanceof HTMLInputElement
  }
  const isIconOnly = (el: Element) => !(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement) && visibleText(el) === ""

  // ---- radius -------------------------------------------------------------------------------------------------
  const CORNERS = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"] as const
  interface Corner {
    px: number
    pct: number | null
  }
  function corners(el: Element): Corner[] {
    const s = cs(el)
    return CORNERS.map((k) => {
      const tok = (s[k] || "0px").split(" ")[0]
      return tok.endsWith("%") ? { px: 0, pct: parseFloat(tok) } : { px: parseFloat(tok) || 0, pct: null }
    })
  }
  const isFull = (k: Corner) => (k.pct !== null ? k.pct >= 50 : k.px >= 9999)
  const maxRadius = (el: Element) => Math.max(...corners(el).map((k) => (isFull(k) ? 1e9 : k.pct !== null ? 0 : k.px)))
  const fmtCorner = (k: Corner) => (k.pct !== null ? `${f2(k.pct)}%` : k.px >= 9999 ? "full" : `${f2(k.px)}px`)

  // ---- icons --------------------------------------------------------------------------------------------------
  const ICON = 'svg.lucide, svg[class*="lucide"], svg[data-slot="icon"], [data-slot="icon"]'
  const isIcon = (el: Element) => el.matches(ICON)

  // ---- hit area -----------------------------------------------------------------------------------------------
  interface Box {
    l: number
    t: number
    r: number
    b: number
  }
  const boxOfRect = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })
  /** A visible surface: something with a border, a background or a shadow, whose corner a person can see. */
  function isSurface(el: Element): boolean {
    const s = cs(el)
    const border = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some((w) => px(w) > 0)
    const bg = s.backgroundColor !== "transparent" && !/rgba?\([^)]*,\s*0\)$/.test(s.backgroundColor) && s.backgroundColor !== "rgba(0, 0, 0, 0)"
    return border || bg || (s.boxShadow !== "none" && s.boxShadow !== "")
  }

  function padBox(el: Element): Box {
    const r = rect(el)
    const s = cs(el)
    return { l: r.left + px(s.borderLeftWidth), t: r.top + px(s.borderTopWidth), r: r.right - px(s.borderRightWidth), b: r.bottom - px(s.borderBottomWidth) }
  }
  function containingBlock(el: Element): Box {
    for (let cur: Element | null = el; cur; cur = cur.parentElement) {
      const s = cs(cur)
      if (s.position !== "static" || (s.transform && s.transform !== "none") || (s.translate && s.translate !== "none") || /paint|layout|strict|content/.test(s.contain) || (s.filter && s.filter !== "none")) return padBox(cur)
    }
    return { l: -window.scrollX, t: -window.scrollY, r: -window.scrollX + document.documentElement.clientWidth, b: -window.scrollY + document.documentElement.clientHeight }
  }
  function pseudoBox(el: Element, which: "::before" | "::after"): Box | null {
    const s = cs(el, which)
    if (!s.content || s.content === "none" || s.content === "normal" || s.display === "none" || s.pointerEvents === "none") return null
    if (s.position !== "absolute" && s.position !== "fixed") return null
    const w = px(s.width)
    const h = px(s.height)
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null
    const cb: Box =
      s.position === "fixed" ? { l: 0, t: 0, r: document.documentElement.clientWidth, b: document.documentElement.clientHeight } : containingBlock(el)
    const mL = px(s.marginLeft) || 0
    const mR = px(s.marginRight) || 0
    const mT = px(s.marginTop) || 0
    const mB = px(s.marginBottom) || 0
    let x: number
    let y: number
    if (s.left !== "auto") x = cb.l + px(s.left) + mL
    else if (s.right !== "auto") x = cb.r - px(s.right) - mR - w
    else return null
    if (s.top !== "auto") y = cb.t + px(s.top) + mT
    else if (s.bottom !== "auto") y = cb.b - px(s.bottom) - mB - h
    else return null
    // translate (individual property, percentages of the box) and transform (matrix).
    let tx = 0
    let ty = 0
    if (s.translate && s.translate !== "none") {
      const [a, b = "0px"] = s.translate.split(" ")
      tx = a.endsWith("%") ? (parseFloat(a) / 100) * w : parseFloat(a)
      ty = b.endsWith("%") ? (parseFloat(b) / 100) * h : parseFloat(b)
    }
    let box: Box = { l: x + tx, t: y + ty, r: x + tx + w, b: y + ty + h }
    if (s.transform && s.transform !== "none") {
      const m = new DOMMatrixReadOnly(s.transform)
      const [ox, oy] = s.transformOrigin.split(" ").map(parseFloat)
      const pts = [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ].map(([px0, py0]) => {
        const p = m.transformPoint(new DOMPoint(px0 - ox, py0 - oy))
        return [box.l + p.x + ox, box.t + p.y + oy]
      })
      box = { l: Math.min(...pts.map((p) => p[0])), r: Math.max(...pts.map((p) => p[0])), t: Math.min(...pts.map((p) => p[1])), b: Math.max(...pts.map((p) => p[1])) }
    }
    return box
  }
  function clipByOverflow(el: Element, box: Box): Box {
    let out = box
    for (let cur: Element | null = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
      const s = cs(cur)
      if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const p = padBox(cur)
        out = {
          l: s.overflowX !== "visible" ? Math.max(out.l, p.l) : out.l,
          r: s.overflowX !== "visible" ? Math.min(out.r, p.r) : out.r,
          t: s.overflowY !== "visible" ? Math.max(out.t, p.t) : out.t,
          b: s.overflowY !== "visible" ? Math.min(out.b, p.b) : out.b,
        }
      }
    }
    return out
  }
  function hits(el: Element, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return true
    const top = document.elementsFromPoint(x, y)[0]
    return !!top && (top === el || el.contains(top))
  }
  function hitArea(el: Element): Box {
    const own = boxOfRect(rect(el))
    const u: Box = { ...own }
    for (const which of ["::before", "::after"] as const) {
      const raw = pseudoBox(el, which)
      if (!raw) continue
      const p = clipByOverflow(el, raw)
      if (p.r <= p.l || p.b <= p.t) continue
      const midX = (p.l + p.r) / 2
      const midY = (p.t + p.b) / 2
      if (p.l < own.l - 0.01 && hits(el, p.l + 1, midY)) u.l = Math.min(u.l, p.l)
      if (p.r > own.r + 0.01 && hits(el, p.r - 1, midY)) u.r = Math.max(u.r, p.r)
      if (p.t < own.t - 0.01 && hits(el, midX, p.t + 1)) u.t = Math.min(u.t, p.t)
      if (p.b > own.b + 0.01 && hits(el, midX, p.b - 1)) u.b = Math.max(u.b, p.b)
    }
    return u
  }

  // ---- layout snapshots ---------------------------------------------------------------------------------------
  /** The density that governs an element: the nearest [data-density] above it, else the page's. */
  function densityOf(el: Element, o: StaticOpts): { name: string; height: number } {
    const name = el.closest("[data-density]")?.getAttribute("data-density") ?? o.density
    return { name, height: o.densityHeights[name] ?? o.expectedHeight }
  }

  /** How many lines of text an element's content occupies (distinct line boxes). */
  function lines(el: Element): number {
    const range = document.createRange()
    range.selectNodeContents(el)
    const tops = new Set<number>()
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top))
    // Rects of nested inline boxes share a line's top within a few pixels; group them.
    const sorted = [...tops].sort((a, b) => a - b)
    let count = 0
    let last = -Infinity
    for (const t of sorted) {
      if (t - last > 4) count++
      last = t
    }
    return count
  }

  type Snap = [number, number, number, number]
  let base = new Map<Element, Snap>()
  function snapshot(): Map<Element, Snap> {
    const style = document.createElement("style")
    style.textContent = "*,*::before,*::after{transform:none!important;translate:none!important;scale:none!important;rotate:none!important}"
    document.head.appendChild(style)
    const out = new Map<Element, Snap>()
    for (const el of all()) {
      const r = rect(el)
      // An element that is not rendered (display:none, or inside one: a hidden Storybook overlay) has no box; scroll
      // compensation would invent a movement for it.
      if (el.getClientRects().length === 0) continue
      let sx = 0
      let sy = 0
      // A fixed-position element (or one inside a fixed container) does not move when its ancestors scroll, so it gets
      // no scroll compensation: adding it would invent a shift.
      let fixed = false
      for (let p: Element | null = el; p && !fixed; p = p.parentElement) fixed = cs(p).position === "fixed"
      if (!fixed) {
        for (let p: Element | null = el.parentElement; p; p = p.parentElement) {
          sx += p.scrollLeft
          sy += p.scrollTop
        }
      }
      out.set(el, [r.x + sx, r.y + sy, r.width, r.height])
    }
    style.remove()
    return out
  }

  // ---- focus ring ---------------------------------------------------------------------------------------------
  function ringOk(el: Element): { ok: boolean; actual: string } {
    const s = cs(el)
    const ow = px(s.outlineWidth)
    const oo = px(s.outlineOffset)
    const outline = s.outlineStyle !== "none" && near(ow, c.focus.width) && near(oo, c.focus.offset)
    const layers = splitTop(s.boxShadow === "none" ? "" : s.boxShadow).map((l) => {
      const inset = /\binset\b/.test(l)
      const nums = l.replace(/(rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix)\([^)]*(\([^)]*\)[^)]*)*\)/g, "").match(/-?[\d.]+px/g) ?? []
      const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(parseFloat)
      return { inset, x, y, blur, spread }
    })
    const flat = layers.filter((l) => !l.inset && l.x === 0 && l.y === 0 && l.blur === 0)
    const ring = flat.some((l) => near(l.spread, c.focus.width)) || (flat.some((l) => near(l.spread, c.focus.offset)) && flat.some((l) => near(l.spread, c.focus.offset + c.focus.width)))
    return { ok: outline || ring, actual: `outline ${s.outlineStyle} ${f2(ow)}px offset ${f2(oo)}px; box-shadow ${s.boxShadow}` }
  }

  const settle = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())))
  const visited = new Set<Element>()

  const api: AuditApi = {
    setDensity(d) {
      for (const el of [document.documentElement, document.body, document.getElementById("storybook-root")]) el?.setAttribute("data-density", d)
    },
    settle,

    static(o) {
      const out: Failure[] = []
      const els = visible()

      // 1. controls
      const controls = els.filter(isControl)
      for (const el of controls) {
        const r = rect(el)
        const size = el.getAttribute("data-size")
        const fixed = size && size !== "default" ? c.sizeHeights[size] : undefined
        const local = densityOf(el, o)
        const want = fixed ?? local.height
        const why = fixed !== undefined ? `data-size=${size}` : `density ${local.name}`
        // A control whose label wraps grows instead of clipping: its height is then a minimum (visual-system.md §3).
        if (lines(el) > 1) {
          if (r.height < want - 0.1) out.push(make("controls.height", "height", el, `>= ${want}px (${why}, wrapped label)`, `${f2(r.height)}px`))
        } else if (!inList(r.height, c.controlHeights)) out.push(make("controls.height", "height", el, `36 | 44 | 52 (${why}: ${want})`, `${f2(r.height)}px`))
        else if (!near(r.height, want)) out.push(make("controls.height", "height", el, `${want}px (${why})`, `${f2(r.height)}px`))
        if (isIconOnly(el) && !near(r.width, r.height)) out.push(make("controls.square", "width", el, "square (width = height)", `${f2(r.width)} x ${f2(r.height)}px`))
      }
      const byParent = new Map<Element, Element[]>()
      for (const el of controls) {
        const p = el.parentElement
        if (p) byParent.set(p, [...(byParent.get(p) ?? []), el])
      }
      for (const group of byParent.values()) {
        const clusters: Element[][] = []
        for (const el of group) {
          const r = rect(el)
          const hit = clusters.filter((cl) => cl.some((o2) => Math.min(rect(o2).bottom, r.bottom) - Math.max(rect(o2).top, r.top) > 1))
          const merged = [el, ...hit.flat()]
          for (const h of hit) clusters.splice(clusters.indexOf(h), 1)
          clusters.push(merged)
        }
        for (const cl of clusters) {
          if (cl.length < 2) continue
          const hs = cl.map((e) => rect(e).height)
          if (Math.max(...hs) - Math.min(...hs) <= 0.01) continue
          const counts = new Map<number, number>()
          for (const h of hs) counts.set(Math.round(h * 100), (counts.get(Math.round(h * 100)) ?? 0) + 1)
          const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0] / 100 - o.expectedHeight) - Math.abs(b[0] / 100 - o.expectedHeight))[0][0] / 100
          for (const e of cl) if (!near(rect(e).height, mode)) out.push(make("controls.row", "height", e, `${f2(mode)}px (its row)`, `${f2(rect(e).height)}px`))
        }
      }

      // 2. targets
      // A text-entry field cannot carry an extended hit area (an <input> has no ::after), so its target is its own box,
      // which must be at least the density's control height (visual-system.md section 3: tight is opt-in for pointer
      // surfaces; people who need large targets are routed to spacious by the composer).
      const textEntry = (el: Element) =>
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable) ||
        (el instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit", "reset", "range", "color", "image", "hidden"].includes(el.type))
      // An element behind an open modal dialog (or under inert or aria-hidden) cannot be acted on right now, so it is
      // not a target until the dialog closes.
      const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], dialog[open]')].filter((d) => d.getClientRects().length > 0)
      const inert = (el: Element) => el.closest('[inert], [aria-hidden="true"]') !== null || (modal.length > 0 && !modal.some((d) => d.contains(el)))
      for (const el of els.filter((e) => e.matches(c.interactive) && !inert(e))) {
        const u = hitArea(el)
        const w = u.r - u.l
        const h = u.b - u.t
        const minH = textEntry(el) ? Math.min(c.target, densityOf(el, o).height) : c.target
        if (w < c.target - 0.1 || h < minH - 0.1) out.push(make("targets.size", "hit-area", el, `>= ${c.target} x ${f2(minH)}px`, `${f2(w)} x ${f2(h)}px`))
      }

      // 3. borders
      for (const el of els) {
        const s = cs(el)
        const sides = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(px)
        if (sides.some((w) => !inList(w, c.borderWidths))) out.push(make("borders.width", "border-width", el, "0 or 1px", `top/right/bottom/left ${sides.map((w) => `${f2(w)}px`).join(" ")}`))
      }

      // 4. type
      for (const el of els) {
        if (!(ownText(el) || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue
        const s = cs(el)
        const fs = px(s.fontSize)
        if (!inList(fs, c.typeSizes)) out.push(make("type.size", "font-size", el, c.typeSizes.join(" | ") + "px", s.fontSize))
        const fw = parseFloat(s.fontWeight)
        if (!inList(fw, c.weights)) out.push(make("type.weight", "font-weight", el, c.weights.join(" | "), s.fontWeight))
        const lh = px(s.lineHeight)
        if (s.lineHeight === "normal" || !Number.isFinite(lh) || !near(lh / c.lineGrid, Math.round(lh / c.lineGrid), 0.01 / c.lineGrid))
          out.push(make("type.line-height", "line-height", el, `a multiple of ${c.lineGrid}px`, s.lineHeight))
      }

      // 5. radius
      for (const el of els) {
        const ks = corners(el)
        const bad = ks.filter((k) => !(isFull(k) || near(k.px, 0) && k.pct === null || (k.pct === null && inList(k.px, o.radii))))
        if (bad.length) out.push(make("radius.tier", "border-radius", el, `${o.radii.join(" | ")}px or full`, ks.map(fmtCorner).join(" ")))
        // Radius hierarchy (section 7): a curve inside a curve is tighter. A flush child (touching its rounded parent on
        // two sides, like a clipped image) may match the parent's corner; any other rounded surface inside a rounded
        // surface is at least one step smaller. Full radius (pills, dots) is a shape, not a level, and is exempt.
        const own = maxRadius(el)
        if (own > 0 && own < 1e9 && isSurface(el)) {
          for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
            const pr = maxRadius(anc)
            if (pr <= 0 || !isSurface(anc)) continue
            if (pr >= 1e9) break
            const pb = padBox(anc)
            const r = rect(el)
            const touching = [near(r.left, pb.l, 0.5), near(r.right, pb.r, 0.5), near(r.top, pb.t, 0.5), near(r.bottom, pb.b, 0.5)].filter(Boolean).length
            if (touching >= 2) {
              if (own > pr + 0.01) out.push(make("radius.nesting", "border-radius", el, `<= parent ${f2(pr)}px (flush in ${slotOf(anc)})`, `${f2(own)}px`))
            } else if (pr < own + o.radiusStep - 0.01) {
              out.push(make("radius.nesting", "border-radius", el, `parent >= ${f2(own + o.radiusStep)}px (one step above ${f2(own)}px)`, `parent ${slotOf(anc)} is ${f2(pr)}px`))
            }
            break
          }
        }
      }

      // 6. icons
      const icons = els.filter(isIcon)
      for (const el of icons) {
        let w: number
        let h: number
        if (el instanceof SVGElement) {
          const s = cs(el)
          w = px(s.width)
          h = px(s.height)
          if (!Number.isFinite(w) || !Number.isFinite(h)) {
            w = rect(el).width
            h = rect(el).height
          }
        } else {
          w = rect(el).width
          h = rect(el).height
        }
        if (!inList(w, c.iconSizes) || !inList(h, c.iconSizes)) out.push(make("icons.size", "size", el, c.iconSizes.join(" | ") + "px", `${f2(w)} x ${f2(h)}px`))
      }

      // 7. whole pixels (DPR 1). Widths and x positions that text decides are exempt: a label's width is the font's.
      const precededByText = (el: Element): boolean => {
        for (let n: Node | null = el; n && n !== document.body; n = n.parentNode) {
          for (let sib = n.previousSibling; sib; sib = sib.previousSibling) {
            if (sib.nodeType === 3 && (sib.textContent ?? "").trim()) return true
            if (sib.nodeType === 1 && (sib as Element).textContent?.trim()) return true
            if (sib.nodeType === 1 && (sib as Element).querySelector("input:not([type=hidden]), select, textarea")) return true
          }
        }
        return false
      }
      const framed = new Set<Element>([...controls, ...icons])
      for (const el of els) {
        const s = cs(el)
        const bordered = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some((w) => px(w) > 0.01)
        if (!bordered && !framed.has(el)) continue
        const r = rect(el)
        const horizontal = visibleText(el) === "" && !(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement) && !precededByText(el)
        const props: string[] = []
        const vals: string[] = []
        const chk = (name: string, v: number) => {
          if (!near(v, Math.round(v))) {
            props.push(name)
            vals.push(`${name}=${f2(v)}`)
          }
        }
        chk("y", r.y)
        chk("height", r.height)
        if (horizontal) {
          chk("x", r.x)
          chk("width", r.width)
        }
        if (props.length) out.push({ ...make("pixels.whole", props[0], el, "whole pixels", vals.join(" ")), properties: props })
      }
      return out
    },

    motion(o) {
      const out: Failure[] = []
      const curve = c.curve.replace(/\s+/g, "")
      const targets: [Element, string | undefined][] = []
      for (const el of [document.documentElement, ...all()]) {
        targets.push([el, undefined])
        for (const p of ["::before", "::after"]) {
          const content = cs(el, p).content
          if (content && content !== "none" && content !== "normal") targets.push([el, p])
        }
      }
      for (const [el, p] of targets) {
        if (p === undefined && el !== document.documentElement && !rendered(el)) continue
        const s = cs(el, p)
        const props = splitTop(s.transitionProperty)
        const durs = times(s.transitionDuration)
        const fns = splitTop(s.transitionTimingFunction)
        for (let i = 0; i < props.length; i++) {
          const d = durs[i % durs.length]
          if (!(d > 0.0001)) continue
          const suffix = p ?? ""
          if (props[i] === "all") out.push(make("motion.all", "transition-property", el, "named properties, never all", `all ${f2(d)}ms`, suffix))
          const fn = fns[i % fns.length]
          if (fn.replace(/\s+/g, "") !== curve) out.push(make("motion.curve", "transition-timing-function", el, c.curve, `${fn} (${props[i]})`, suffix))
          if (!inList(d, o.durations, 0.5)) out.push(make("motion.duration", "transition-duration", el, o.durations.join(" | ") + "ms", `${f2(d)}ms (${props[i]})`, suffix))
        }
      }
      return out
    },

    reduced() {
      const out: Failure[] = []
      for (const el of [document.documentElement, ...all()]) {
        for (const p of [undefined, "::before", "::after"]) {
          if (p) {
            const content = cs(el, p).content
            if (!content || content === "none" || content === "normal") continue
          } else if (el !== document.documentElement && !rendered(el)) continue
          const s = cs(el, p)
          const t = times(s.transitionDuration).filter((d) => d > 0.0100001)
          const a = times(s.animationDuration).filter((d) => d > 0.0100001)
          const suffix = p ?? ""
          if (t.length) out.push(make("motion.reduced", "transition-duration", el, "<= 0.01ms", s.transitionDuration, suffix))
          if (a.length) out.push(make("motion.reduced", "animation-duration", el, "<= 0.01ms", s.animationDuration, suffix))
        }
      }
      return out
    },

    interactive() {
      return visible()
        .filter((el) => el.matches(c.interactive))
        .map((el) => ({ id: idOf(el), slot: slotOf(el), selector: selector(el) }))
    },

    prepare(id) {
      const el = byId.get(id)
      if (!el || !el.isConnected) return null
      el.scrollIntoView({ block: "center", inline: "center" })
      const r = rect(el)
      if (r.width <= 0 || r.height <= 0) return null
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    },

    baseline() {
      base = snapshot()
    },

    compare(rule, triggerId) {
      const trigger = triggerId === null ? document.activeElement : byId.get(triggerId)
      if (!trigger) return []
      const now = snapshot()
      const moved: string[] = []
      for (const [el, b] of base) {
        const n = now.get(el)
        if (!n || !el.isConnected) continue
        const d = [n[0] - b[0], n[1] - b[1], n[2] - b[2], n[3] - b[3]]
        if (d.some((v) => Math.abs(v) > 0.5)) moved.push(`${slotOf(el)} ${selector(el)} (dx ${f2(d[0])}, dy ${f2(d[1])}, dw ${f2(d[2])}, dh ${f2(d[3])})`)
      }
      if (!moved.length) return []
      return [make(rule, "layout", trigger, "no box moves or resizes by more than 0.5px", `${moved.length} moved: ${moved.slice(0, 3).join("; ")}`)]
    },

    focusCheck() {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement || visited.has(el)) return { end: true, failures: [] }
      visited.add(el)
      idOf(el)
      const failures: Failure[] = []
      const ring = ringOk(el)
      if (!ring.ok) failures.push(make("focus.ring", "outline", el, `outline ${c.focus.width}px offset ${c.focus.offset}px (or an equivalent ${c.focus.width}px ring)`, ring.actual))
      return { end: false, failures }
    },

    focusById(id) {
      const el = byId.get(id)
      if (!el || !el.isConnected || visited.has(el)) return false
      ;(el as HTMLElement).focus({ preventScroll: true })
      return document.activeElement === el
    },

    blur() {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      visited.clear()
    },
  }
  window.__audit = api
}
